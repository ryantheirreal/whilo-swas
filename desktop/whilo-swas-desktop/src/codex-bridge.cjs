'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn: nodeSpawn } = require('node:child_process');

const MAX_PROMPT_CHARS = 12000;
const MAX_STREAM_BYTES = 1024 * 1024;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const STATUS_TIMEOUT_MS = 12000;
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}
function sanitizeOutput(value, maxLength = 700) {
  return stripAnsi(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,})\b/g, '[credential redacted]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, maxLength);
}
function sanitizeLoginLine(value) {
  const line = sanitizeOutput(value, 600).trim();
  if (!line) return '';
  const urls = line.match(/https?:\/\/[^\s<>"']+/gi) || [];
  let output = line;
  for (const raw of urls) {
    let allowed = false;
    try {
      const url = new URL(raw.replace(/[),.;]+$/, ''));
      allowed = url.protocol === 'https:' &&
        ['auth.openai.com', 'chatgpt.com', 'openai.com'].includes(url.hostname);
    } catch (_) {}
    if (!allowed) output = output.replace(raw, '[external URL omitted]');
  }
  return output.slice(0, 500);
}
function isExecutable(filePath, platform, existsSync, statSync, accessSync) {
  if (!filePath || !path.isAbsolute(filePath)) return false;
  const extension = path.extname(filePath).toLowerCase();
  if (platform === 'win32' && !['.exe', '.com'].includes(extension)) return false;
  if (platform !== 'win32' && ['.cmd', '.bat'].includes(extension)) return false;
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
    if (platform !== 'win32') accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (_) {
    return false;
  }
}
function resolveCodexExecutable(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const existsSync = options.existsSync || fs.existsSync;
  const statSync = options.statSync || fs.statSync;
  const accessSync = options.accessSync || fs.accessSync;
  const candidateNames = platform === 'win32' ? ['codex.exe', 'codex.com'] : ['codex'];
  const candidates = [];
  if (env.WHILO_CODEX_PATH) candidates.push(path.resolve(env.WHILO_CODEX_PATH));
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const commonDirs = platform === 'win32'
    ? [
        path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'Codex'),
        path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'OpenAI', 'Codex', 'bin')
      ]
    : [
        path.join(home, '.local', 'bin'),
        path.join(home, '.npm-global', 'bin'),
        path.join(home, '.volta', 'bin'),
        path.join(home, '.local', 'share', 'pnpm'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin'
      ];
  for (const directory of String(env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of candidateNames) candidates.push(path.join(directory, name));
  }
  for (const directory of commonDirs) {
    for (const name of candidateNames) candidates.push(path.join(directory, name));
  }
  for (const candidate of [...new Set(candidates)]) {
    if (isExecutable(candidate, platform, existsSync, statSync, accessSync)) return candidate;
  }
  return null;
}

function createCodexBridge(options = {}) {
  const app = options.app;
  const dialog = options.dialog;
  const emit = typeof options.emit === 'function' ? options.emit : function() {};
  const spawn = options.spawn || nodeSpawn;
  const platform = options.platform || process.platform;
  const baseEnv = options.env || process.env;
  const fileSystem = options.fs || fs;
  const codexHome = path.join(app.getPath('userData'), 'codex-home');
  let selectedWorkspace = null;
  let loginChild = null;
  let activeRun = null;
  let disposed = false;

  function event(type, detail = {}) {
    if (disposed) return;
    try { emit(Object.assign({ type, at: new Date().toISOString() }, detail)); } catch (_) {}
  }
  function secureEnv() {
    const env = Object.assign({}, baseEnv, { CODEX_HOME: codexHome, NO_COLOR: '1' });
    // Never let a shell environment silently switch this ChatGPT-account integration to API billing.
    delete env.OPENAI_API_KEY;
    delete env.CODEX_API_KEY;
    delete env.CODEX_ACCESS_TOKEN;
    delete env.OPENAI_BASE_URL;
    return env;
  }
  function executable() {
    try { fileSystem.mkdirSync(codexHome, { recursive: true, mode: 0o700 }); } catch (_) {}
    return resolveCodexExecutable({
      platform,
      env: secureEnv(),
      existsSync: fileSystem.existsSync.bind(fileSystem),
      statSync: fileSystem.statSync.bind(fileSystem),
      accessSync: fileSystem.accessSync.bind(fileSystem)
    });
  }
  function requireExecutable() {
    const value = executable();
    if (!value) {
      const error = new Error(platform === 'win32'
        ? 'Codex CLI was not found as a standalone executable. Install the official Codex CLI, then reopen Whilo Desktop. The app does not run .cmd/.bat shims through a shell.'
        : 'Codex CLI was not found. Install the official Codex CLI, sign in through Whilo Desktop, and retry.');
      error.code = 'codex_cli_missing';
      throw error;
    }
    return value;
  }
  function runProbe(binary, args, cwd, timeoutMs = STATUS_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      let child;
      let stdout = '';
      let stderr = '';
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        try { child && child.kill('SIGTERM'); } catch (_) {}
        settle(reject, Object.assign(new Error('The local Codex command timed out.'), { code: 'codex_command_timeout' }));
      }, timeoutMs);
      try {
        child = spawn(binary, args, {
          cwd: cwd || (app && app.getPath ? app.getPath('home') : os.homedir()),
          env: secureEnv(),
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (_) {
        settle(reject, Object.assign(new Error('Codex CLI could not be started.'), { code: 'codex_spawn_failed' }));
        return;
      }
      const push = (target, chunk) => {
        target.value += String(chunk || '');
        if (target.value.length > 16000) target.value = target.value.slice(-16000);
      };
      child.stdout && child.stdout.on('data', chunk => push({ get value(){return stdout;}, set value(v){stdout=v;} }, chunk));
      child.stderr && child.stderr.on('data', chunk => push({ get value(){return stderr;}, set value(v){stderr=v;} }, chunk));
      child.once('error', () => settle(reject, Object.assign(new Error('Codex CLI could not be started.'), { code: 'codex_spawn_failed' })));
      child.once('close', code => settle(resolve, { code: Number.isInteger(code) ? code : 1, stdout, stderr }));
    });
  }
  async function status() {
    const binary = executable();
    if (!binary) return {
      available: false, installed: false, loggedIn: false, authMode: 'none',
      workspace: selectedWorkspace ? path.basename(selectedWorkspace) : '',
      error: 'Install the official Codex CLI to connect ChatGPT on this computer.'
    };
    try {
      const result = await runProbe(binary, ['login', 'status'], selectedWorkspace || (app && app.getPath ? app.getPath('home') : os.homedir()));
      const text = sanitizeOutput(result.stdout + '\n' + result.stderr, 500);
      const loggedIn = result.code === 0 && /logged\s+in/i.test(text) && /chatgpt/i.test(text) && !/not\s+logged\s+in/i.test(text);
      return {
        available: true, installed: true, loggedIn,
        authMode: loggedIn ? 'chatgpt' : 'none',
        accountLabel: loggedIn ? 'ChatGPT account' : '',
        workspace: selectedWorkspace ? path.basename(selectedWorkspace) : '',
        workspacePath: selectedWorkspace || '',
        message: loggedIn ? 'Connected with the official Codex CLI using ChatGPT sign-in.' : 'Not connected to a ChatGPT account in Whilo Desktop.'
      };
    } catch (error) {
      return {
        available: true, installed: true, loggedIn: false, authMode: 'none',
        workspace: selectedWorkspace ? path.basename(selectedWorkspace) : '',
        error: sanitizeOutput(error && error.message ? error.message : 'Codex sign-in status could not be checked.', 300)
      };
    }
  }
  async function chooseWorkspace() {
    if (disposed) throw new Error('The local Codex bridge is shutting down.');
    if (!dialog || typeof dialog.showOpenDialog !== 'function') throw new Error('The desktop folder picker is not available.');
    const result = await dialog.showOpenDialog(options.getWindow ? options.getWindow() : undefined, {
      title: 'Choose a Git workspace for Codex',
      buttonLabel: 'Use this workspace',
      properties: ['openDirectory']
    });
    if (!result || result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
      return { cancelled: true, workspace: selectedWorkspace ? path.basename(selectedWorkspace) : '' };
    }
    let real;
    try {
      real = fileSystem.realpathSync(result.filePaths[0]);
      const info = fileSystem.statSync(real);
      if (!info.isDirectory()) throw new Error('not_directory');
      const gitMarker = path.join(real, '.git');
      if (!fileSystem.existsSync(gitMarker)) {
        throw new Error('not_git_root');
      }
    } catch (error) {
      const message = error && error.message === 'not_git_root'
        ? 'Choose the root folder of a Git repository. Codex requires a Git workspace for these local runs.'
        : 'The selected folder could not be verified as a local workspace.';
      const wrapped = new Error(message);
      wrapped.code = error && error.message === 'not_git_root' ? 'codex_workspace_not_git' : 'codex_workspace_invalid';
      throw wrapped;
    }
    selectedWorkspace = real;
    event('workspace-selected', { workspace: path.basename(real), workspacePath: real });
    return { cancelled: false, workspace: path.basename(real), workspacePath: real };
  }
  function formatRunProgress(line) {
    let parsed;
    try { parsed = JSON.parse(line); } catch (_) { return; }
    if (!parsed || typeof parsed.type !== 'string') return;
    if (parsed.type === 'thread.started') {
      event('run-progress', { phase: 'started', message: 'Codex task started.' });
    } else if (parsed.type === 'turn.started') {
      event('run-progress', { phase: 'working', message: 'Codex is working in the selected Git workspace.' });
    } else if (parsed.type === 'item.started') {
      event('run-progress', { phase: 'step', message: 'Codex started a task step.' });
    } else if (parsed.type === 'item.completed' && parsed.item && parsed.item.type === 'agent_message') {
      const text = typeof parsed.item.text === 'string' ? parsed.item.text : '';
      if (text.trim()) activeRun && (activeRun.finalText = (activeRun.finalText ? activeRun.finalText + '\n\n' : '') + text.slice(0, 50000));
      event('run-progress', { phase: 'step-complete', message: 'Codex completed a task step.' });
    } else if (parsed.type === 'turn.failed' || parsed.type === 'error') {
      event('run-progress', { phase: 'error', message: 'Codex reported a run error. The final result will include the exit status.' });
    } else if (parsed.type === 'turn.completed') {
      event('run-progress', { phase: 'finishing', message: 'Codex is finalizing the result.' });
    }
  }
  async function runTask(input = {}) {
    if (activeRun) {
      const error = new Error('A local Codex task is already running. Stop it or wait until it finishes.');
      error.code = 'codex_task_busy';
      throw error;
    }
    const prompt = String(input.prompt || '').trim();
    if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
      const error = new Error('Enter a task between 1 and ' + MAX_PROMPT_CHARS + ' characters.');
      error.code = 'codex_invalid_prompt';
      throw error;
    }
    if (!selectedWorkspace) {
      const error = new Error('Choose a Git workspace before running a local Codex task.');
      error.code = 'codex_workspace_required';
      throw error;
    }
    const mode = input.mode === 'workspace-write' ? 'workspace-write' : 'read-only';
    const auth = await status();
    if (!auth.loggedIn) {
      const error = new Error(auth.error || 'Connect an official ChatGPT account through Codex first.');
      error.code = 'codex_chatgpt_login_required';
      throw error;
    }
    const binary = requireExecutable();
    const args = ['exec', '--json', '--ephemeral', '--sandbox', mode, prompt];
    const child = spawn(binary, args, {
      cwd: selectedWorkspace,
      env: secureEnv(),
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const run = { child, finalText: '', bytes: 0, timedOut: false, settled: false };
    activeRun = run;
    event('run-progress', {
      phase: 'started',
      mode: mode,
      workspace: path.basename(selectedWorkspace),
      message: mode === 'read-only'
        ? 'Starting a read-only Codex task in ' + path.basename(selectedWorkspace) + '.'
        : 'Starting a Codex task allowed to edit files inside ' + path.basename(selectedWorkspace) + '.'
    });
    return new Promise((resolve, reject) => {
      let stdoutCarry = '';
      const complete = (fn, value) => {
        if (run.settled) return;
        run.settled = true;
        clearTimeout(timer);
        if (activeRun === run) activeRun = null;
        fn(value);
      };
      const processOutput = chunk => {
        const text = String(chunk || '');
        run.bytes += Buffer.byteLength(text, 'utf8');
        if (run.bytes > MAX_STREAM_BYTES) {
          run.timedOut = true;
          try { child.kill('SIGTERM'); } catch (_) {}
          event('run-progress', { phase: 'error', message: 'Codex output exceeded Whilo’s safety limit; the run was stopped.' });
          return;
        }
        stdoutCarry += text;
        if (stdoutCarry.length > MAX_STREAM_BYTES) stdoutCarry = stdoutCarry.slice(-MAX_STREAM_BYTES);
        const lines = stdoutCarry.split(/\r?\n/);
        stdoutCarry = lines.pop() || '';
        for (const line of lines) formatRunProgress(line);
      };
      const timer = setTimeout(() => {
        run.timedOut = true;
        try { child.kill('SIGTERM'); } catch (_) {}
        event('run-progress', { phase: 'timeout', message: 'Codex exceeded the 10-minute task limit and was stopped.' });
      }, RUN_TIMEOUT_MS);
      child.stdout && child.stdout.on('data', processOutput);
      child.stderr && child.stderr.on('data', chunk => {
        const text = sanitizeOutput(chunk, 1200);
        if (text.trim()) event('run-progress', { phase: 'detail', message: text.slice(-500) });
      });
      child.once('error', () => complete(reject, Object.assign(new Error('Codex could not start this local task.'), { code: 'codex_spawn_failed' })));
      child.once('close', code => {
        if (stdoutCarry.trim()) formatRunProgress(stdoutCarry);
        if (run.timedOut) {
          complete(reject, Object.assign(new Error('Codex task stopped after its time or output limit.'), { code: 'codex_run_limit' }));
          return;
        }
        if (code !== 0) {
          complete(reject, Object.assign(new Error('Codex exited before confirming a successful result. Check its sign-in status and CLI diagnostics.'), { code: 'codex_run_failed' }));
          return;
        }
        const finalText = sanitizeOutput(run.finalText, 50000).trim();
        if (!finalText) {
          complete(reject, Object.assign(new Error('Codex exited without a final message. No completed result can be displayed.'), { code: 'codex_empty_result' }));
          return;
        }
        event('run-complete', { ok: true, workspace: path.basename(selectedWorkspace), mode, text: finalText });
        complete(resolve, { ok: true, workspace: path.basename(selectedWorkspace), mode, text: finalText });
      });
    });
  }
  function cancelLogin() {
    if (!loginChild) return { stopped: false };
    const child = loginChild;
    loginChild = null;
    try { child.kill('SIGTERM'); } catch (_) {}
    event('login-finished', { ok: false, cancelled: true, message: 'ChatGPT device sign-in was cancelled.' });
    return { stopped: true };
  }
  function startLogin() {
    if (loginChild) {
      const error = new Error('A ChatGPT sign-in is already in progress.');
      error.code = 'codex_login_busy';
      throw error;
    }
    const binary = requireExecutable();
    try { fileSystem.mkdirSync(codexHome, { recursive: true, mode: 0o700 }); } catch (_) {}
    const child = spawn(binary, ['login', '--device-auth'], {
      cwd: app && app.getPath ? app.getPath('home') : os.homedir(),
      env: secureEnv(),
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    loginChild = child;
    let carry = '';
    let loginBytes = 0;
    event('login-started', { message: 'Starting the official Codex device-code flow. Complete the approval in your browser.' });
    const onOutput = chunk => {
      loginBytes += Buffer.byteLength(String(chunk || ''), 'utf8');
      if (loginBytes > 40000) {
        cancelLogin();
        return;
      }
      carry += String(chunk || '');
      const lines = carry.split(/\r?\n/);
      carry = lines.pop() || '';
      for (const line of lines) {
        const message = sanitizeLoginLine(line);
        if (message) event('login-output', { message });
      }
    };
    child.stdout && child.stdout.on('data', onOutput);
    child.stderr && child.stderr.on('data', onOutput);
    child.once('error', () => {
      if (loginChild === child) loginChild = null;
      event('login-finished', { ok: false, message: 'Codex could not start the device-code login.' });
    });
    child.once('close', async code => {
      if (loginChild === child) loginChild = null;
      const tail = sanitizeLoginLine(carry);
      if (tail) event('login-output', { message: tail });
      if (code === 0) {
        const result = await status();
        event('login-finished', {
          ok: result.loggedIn,
          message: result.loggedIn
            ? 'ChatGPT OAuth completed. Codex is connected on this computer.'
            : 'Codex finished the login process, but ChatGPT sign-in could not be verified.'
        });
      } else {
        event('login-finished', {
          ok: false,
          message: code === null ? 'Codex sign-in was stopped.' : 'Codex device sign-in failed. Enable device-code login in your ChatGPT security settings or workspace permissions, then retry.'
        });
      }
    });
    return { started: true, authMode: 'chatgpt_device_code' };
  }
  async function logout() {
    if (loginChild) cancelLogin();
    const binary = requireExecutable();
    const result = await runProbe(binary, ['logout'], selectedWorkspace || (app && app.getPath ? app.getPath('home') : os.homedir()));
    if (result.code !== 0) throw Object.assign(new Error('Codex could not sign out. Try again or review the official Codex CLI diagnostics.'), { code: 'codex_logout_failed' });
    event('login-finished', { ok: false, message: 'Codex has signed out of this Whilo Desktop profile.' });
    return status();
  }
  function cancelTask() {
    if (!activeRun) return { stopped: false };
    try { activeRun.child.kill('SIGTERM'); } catch (_) {}
    event('run-progress', { phase: 'cancelling', message: 'Stopping the local Codex task.' });
    return { stopped: true };
  }
  function dispose() {
    disposed = true;
    if (loginChild) { try { loginChild.kill('SIGTERM'); } catch (_) {} loginChild = null; }
    if (activeRun && activeRun.child) { try { activeRun.child.kill('SIGTERM'); } catch (_) {} activeRun = null; }
  }

  return Object.freeze({
    status, chooseWorkspace, startLogin, cancelLogin, logout, runTask, cancelTask, dispose,
    get selectedWorkspace() { return selectedWorkspace; }
  });
}

module.exports = { createCodexBridge, resolveCodexExecutable, sanitizeOutput, sanitizeLoginLine, MAX_PROMPT_CHARS };
