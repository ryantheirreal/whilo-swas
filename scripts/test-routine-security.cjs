'use strict';

const assert = require('node:assert/strict');
const { validateHttpsTarget, isPublicIp, resolvePublicHttpsTarget } = require('../web/whilo-swas/server/security/public-target');

function rejectsUrl(value) {
  assert.throws(() => validateHttpsTarget(value), { statusCode: 400 }, value);
}

async function main() {
  assert.equal(validateHttpsTarget('https://example.com/weekly?view=summary'), 'https://example.com/weekly?view=summary');
  assert.equal(validateHttpsTarget(''), null);
  rejectsUrl('http://example.com');
  rejectsUrl('https://127.0.0.1/');
  rejectsUrl('https://[::1]/');
  rejectsUrl('https://169.254.169.254/latest/meta-data/');
  rejectsUrl('https://router.local/');
  rejectsUrl('https://service.internal/');
  rejectsUrl('https://user:pass@example.com/');
  rejectsUrl('https://example.com:8443/');
  rejectsUrl('https://example.com/?access_token=secret');
  rejectsUrl('https://example.com/?api_key=secret');

  assert.equal(isPublicIp('8.8.8.8'), true);
  assert.equal(isPublicIp('2606:4700:4700::1111'), true);
  for (const address of [
    '127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1',
    '169.254.169.254', '100.100.100.200', '198.18.0.1', '224.0.0.1', '::1',
    'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1'
  ]) assert.equal(isPublicIp(address), false, address);
  assert.equal(isPublicIp('not-an-ip'), false);

  const publicLookup = async () => [{ address: '8.8.8.8', family: 4 }];
  assert.equal(await resolvePublicHttpsTarget('https://example.com', publicLookup), 'https://example.com/');

  const privateLookup = async () => [{ address: '127.0.0.1', family: 4 }];
  await assert.rejects(resolvePublicHttpsTarget('https://example.com', privateLookup), { statusCode: 400 });

  const mixedLookup = async () => [
    { address: '8.8.8.8', family: 4 },
    { address: '10.0.0.7', family: 4 }
  ];
  await assert.rejects(resolvePublicHttpsTarget('https://example.com', mixedLookup), { statusCode: 400 });
  console.log('Routine target security tests passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
