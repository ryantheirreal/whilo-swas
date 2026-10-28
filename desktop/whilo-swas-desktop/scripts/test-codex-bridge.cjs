'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { createCodexBridge, resolveCodexExecutable, sanitizeOutput, sanitizeLoginLine } = require('../src/codex-bridge.cjs');

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.killSignal = null;
  }
  kill(signal) {
    this.killSignal = signal;
    queueMicrotask(() => this.emit('close', null));
    return true;
  }
}
function delay(ms = 8) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitFor(predicate, ms = 800) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    if (predicate()) return;
    await delay(4);
  }
  throw new Error('Timed out waiting for the fake Codex process.');
}
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whilo-codex-test-'));
  const home = path.join(root, 'home');
  const userData = path.join(root, 'whilo-user-data');
  const workspace = path.join(root, 'sample-repository');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(path.join(workspace, '.git'), { recursive: true });
  const executable = path.join(root, process.platform === 'win32' ? 'codex.exe' : 'codex');
  fs.writeFileSync(executable, 'fake test executable');
  if (process.platform !== 'win32') fs.chmodSync(executable, 0o700);

  try {
    const resolved = resolveCodexExecutable({
      platform: process.platform,
      env: { HOME: home, USERPROFILE: home, PATH: '', WHILO_CODEX_PATH: executable },
      existsSync: fs.existsSync.bind(fs),
      statSync: fs.statSync.bind(fs),
      accessSync: fs.accessSync.bind(fs)
    });
    assert.equal(resolved, executable, 'explicit standalone Codex path is discovered');
    assert.match(sanitizeOutput('Bearer secret-token-abcdefghijklmnop'), /Bearer \[redacted\]/);
    assert.match(sanitizeOutput('sk-ant-abcdefghijklmnop123456'), /\[credential redacted\]/);
    assert.match(sanitizeLoginLine('Visit https://evil.example/login now'), /\[external URL omitted\]/);
    assert.match(sanitizeLoginLine('Visit https://auth.openai.com/codex/device'), /https:\/\/auth\.openai\.com/);

    const calls = [];
    const events = [];
    const approvals = [];
    let authenticated = false;
    let deviceLoginChild = null;
    const dialog = {
      async showOpenDialog() { return { canceled: false, filePaths: [workspace] }; },
      async showMessageBox(_window, config) {
        approvals.push(config);
        return { response: 0 };
      }
    };
    const fakeSpawn = (command, args, options) => {
      const child = new FakeChild();
      calls.push({ command, args: args.slice(), options, child });
      if (args[0] === 'login' && args[1] === 'status') {
        queueMicrotask(() => {
          child.stdout.write(authenticated ? 'Logged in using ChatGPT\\n' : 'Not logged in\\n');
          child.emit('close', authenticated ? 0 : 1);
        });
      } else if (args[0] === 'login' && args[1] === '--device-auth') {
        deviceLoginChild = child;
        queueMicrotask(() => child.stdout.write('Open https://auth.openai.com/codex/device\\n'));
      } else if (args[0] === 'exec') {
        queueMicrotask(() => {
          child.stdout.write(JSON.stringify({ type:'thread.started', thread_id:'fake-thread' }) + '\\n');
          child.stdout.write(JSON.stringify({ type:'item.completed', item:{ type:'agent_message', text:'Codex test completed.' } }) + '\\n');
          child.stdout.write(JSON.stringify({ type:'turn.completed' }) + '\\n');
          child.emit('close', 0);
        });
      } else if (args[0] === 'logout') {
        queueMicrotask(() => {
          authenticated = false;
          child.stdout.write('Logged out\\n');
          child.emit('close', 0);
        });
      } else {
        queueMicrotask(() => child.emit('close', 2));
      }
      return child;
    };
    const bridge = createCodexBridge({
      app: { getPath(name) { return name === 'userData' ? userData : home; } },
      dialog,
      platform: process.platform,
      env: Object.assign({}, process.env, {
        HOME: home,
        USERPROFILE: home,
        PATH: '',
        WHILO_CODEX_PATH: executable,
        OPENAI_API_KEY: 'should-not-enter-child-env',
        CODEX_API_KEY: 'should-not-enter-child-env-either',
        CODEX_ACCESS_TOKEN: 'also-secret'
      }),
      spawn: fakeSpawn,
      emit(payload) { events.push(payload); }
    });

    const initial = await bridge.status();
    assert.equal(initial.installed, true);
    assert.equal(initial.loggedIn, false);
    assert.equal(initial.authMode, 'none');

    const login = bridge.startLogin();
    assert.equal(login.started, true);
    await waitFor(() => deviceLoginChild !== null);
    await waitFor(() => events.some(item => item.type === 'login-output'));
    assert.ok(events.some(item => item.type === 'login-output' && item.message.includes('auth.openai.com')));
    authenticated = true;
    deviceLoginChild.emit('close', 0);
    await waitFor(() => events.some(item => item.type === 'login-finished' && item.ok === true));
    const loggedIn = await bridge.status();
    assert.equal(loggedIn.loggedIn, true);
    assert.equal(loggedIn.authMode, 'chatgpt');

    const selected = await bridge.chooseWorkspace();
    assert.equal(selected.workspace, 'sample-repository');
    assert.equal(bridge.selectedWorkspace, fs.realpathSync(workspace));

    const readResult = await bridge.runTask({ prompt:'Summarize this repository', mode:'read-only' });
    assert.equal(readResult.ok, true);
    assert.equal(readResult.text, 'Codex test completed.');
    const runCall = calls.filter(item => item.args[0] === 'exec').at(-1);
    assert.deepEqual(runCall.args.slice(0,5), ['exec','--json','--ephemeral','--sandbox','read-only']);
    assert.equal(runCall.options.cwd, fs.realpathSync(workspace));
    assert.equal(runCall.options.shell, false);
    assert.equal(runCall.options.env.OPENAI_API_KEY, undefined);
    assert.equal(runCall.options.env.CODEX_API_KEY, undefined);
    assert.equal(runCall.options.env.CODEX_ACCESS_TOKEN, undefined);
    assert.equal(runCall.options.env.CODEX_HOME, path.join(userData, 'codex-home'));
    assert.ok(approvals.some(config => config.message.includes('read this Git workspace')));

    const writeResult = await bridge.runTask({ prompt:'Edit one test file, then stop', mode:'workspace-write' });
    assert.equal(writeResult.ok, true);
    const writeCall = calls.filter(item => item.args[0] === 'exec').at(-1);
    assert.equal(writeCall.args[4], 'workspace-write');
    assert.ok(approvals.some(config => config.message.includes('edit files')));

    const signOut = await bridge.logout();
    assert.equal(signOut.loggedIn, false);
    bridge.dispose();
    console.log('Codex bridge tests passed (CLI discovery, device OAuth, ChatGPT-only status, Git workspace, native approval, sandbox mode and secret isolation).');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
