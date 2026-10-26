'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const enterprise = fs.readFileSync(path.join(root, 'web/whilo-swas/whilo-enterprise.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'web/whilo-swas/whilo-marketplace.js'), 'utf8');

assert.ok(enterprise.includes('function showWorkspaceRecovery(reason)'), 'Global recovery UI is available for unexpected runtime errors');
assert.ok(enterprise.includes("window.addEventListener('unhandledrejection'"), 'Unhandled async errors cannot silently leave the workspace blank');
assert.ok(enterprise.includes("if (act === 'render-retry')"), 'Recovery screen can retry the current view');
assert.ok(enterprise.includes("if (act === 'render-home')"), 'Recovery screen can return to the safe Work view');
assert.ok(store.includes('data-page="plugins"'), 'Store includes a first-class Plugins top-bar tab');
assert.ok(store.includes('function pluginsPage()'), 'Plugins tab has a discoverable catalog');
assert.ok(store.includes("action==='plugins-save'"), 'A GitHub skill reference can be saved to the authenticated Whilo Library');
assert.ok(store.includes("trustState:'unreviewed'"), 'Imported plugin references remain untrusted and are not executed automatically');
assert.ok(store.includes('rel="noopener noreferrer"'), 'External GitHub links are isolated from the opener');
assert.ok(store.includes("new CustomEvent('whilo:marketplace:open-connect')"), 'Plugin connection guidance opens the Whilo Connect surface');
assert.ok(store.includes('https://github.com/milind-soni/OpenMausBot'), 'OpenMausBot architecture research is discoverable from Plugins');
console.log('Whilo UI resilience and Plugins navigation tests passed.');