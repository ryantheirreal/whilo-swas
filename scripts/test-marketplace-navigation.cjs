#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const enterprise = fs.readFileSync(path.join(root, 'web/whilo-swas/whilo-enterprise.js'), 'utf8');
const marketplace = fs.readFileSync(path.join(root, 'web/whilo-swas/whilo-marketplace.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'web/whilo-swas/package.json'), 'utf8'));
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const nav = marketplace.match(/<nav class="nav" aria-label="Apps">([\s\S]*?)<\/nav>/);
if (!nav) fail('Apps navigation must exist inside the existing Marketplace surface.');
else {
  const primary = nav[1].match(/<button[^>]*data-page="(discover|plugins|skills)"[^>]*>(Apps|Plugins|Skills)<\/button>/g) || [];
  if (primary.length !== 3) fail('Primary navigation must expose exactly Apps, Plugins and Skills.');
  for (const label of ['Apps', 'Plugins', 'Skills']) {
    if (!nav[1].includes('>'+label+'</button>')) fail('Missing primary section: '+label);
  }
  if (!nav[1].includes('data-page="library"') || !nav[1].includes('data-page="creator"') ||
      !nav[1].includes('data-page="review"') || !nav[1].includes('data-page="plans"')) {
    fail('Library, Creator Studio, Review Queue and Plans must remain reachable under Manage.');
  }
}
if (!marketplace.includes("page==='skills'?skillsPage()")) fail('Skills needs a first-class routed page.');
if (!marketplace.includes('function skillsPage()')) fail('Skills catalog page is missing.');
if (!marketplace.includes("url:'https://github.com/anthropics/skills'") ||
    !marketplace.includes("url:'https://github.com/vercel-labs/agent-skills'") ||
    !marketplace.includes("url:'https://github.com/obra/superpowers'")) {
  fail('The skills page must preserve the three researched skills sources.');
}
if (!marketplace.includes("(apps|store|loja|marketplace)")) fail('Existing Store tab discovery must also recognize Apps.');
if (!marketplace.includes("button.setAttribute('aria-label','Apps')") ||
    !marketplace.includes("button.setAttribute('title','Apps')")) fail('The existing Marketplace entry must be renamed to Apps, not duplicated.');
if (!enterprise.includes("'[data-whilo-message-tab]'") ||
    !enterprise.includes("'[data-whilo-routines-chat-launcher]'") ||
    !enterprise.includes("'[data-whilo-enterprise-tab]'")) {
  fail('Legacy injected top-level actions must be removed from the shell.');
}
if (/data-whilo-enterprise-tab.{0,120}appendChild/.test(enterprise) ||
    /data-whilo-routines-chat-launcher.{0,120}appendChild/.test(enterprise)) {
  fail('The enterprise layer must not append extra top-level navigation actions.');
}
if (!pkg.scripts.check.includes('test-marketplace-navigation.cjs')) fail('The navigation regression test must run in npm check.');
if (process.exitCode) process.exit(process.exitCode);
console.log('Marketplace navigation checks passed.');
