'use strict';

const dns = require('node:dns/promises');
const net = require('node:net');

const blockedIPv4Addresses = new net.BlockList();
const blockedIPv6Addresses = new net.BlockList();
const blockedIPv4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
];
const blockedIPv6 = [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96],
  ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
];
for (const [address, prefix] of blockedIPv4) blockedIPv4Addresses.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of blockedIPv6) blockedIPv6Addresses.addSubnet(address, prefix, 'ipv6');

const BLOCKED_SUFFIXES = [
  '.localhost', '.local', '.internal', '.test', '.invalid', '.example',
  '.onion', '.arpa', '.lan', '.home.arpa'
];

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function validateHttpsTarget(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  if (raw.length > 2048) fail('Routine targets must be no longer than 2048 characters.');

  let url;
  try { url = new URL(raw); }
  catch (_) { fail('Use a valid public HTTPS target URL.'); }

  if (url.protocol !== 'https:' || url.username || url.password) {
    fail('Routine targets must use HTTPS without embedded credentials.');
  }
  if (url.port && url.port !== '443') {
    fail('Routine targets may only use the standard HTTPS port.');
  }

  const hostname = String(url.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!hostname || !hostname.includes('.')) fail('Use a fully qualified public hostname for routine targets.');
  if (net.isIP(hostname)) fail('IP-literal targets are not allowed; use a verified HTTPS hostname.');
  if (BLOCKED_SUFFIXES.some(suffix => hostname === suffix.slice(1) || hostname.endsWith(suffix))) {
    fail('Private, local, and reserved hostnames cannot be routine targets.');
  }
  for (const key of url.searchParams.keys()) {
    if (/(token|secret|password|api.?key|authorization|auth|session|signature|^sig$|^code$)/i.test(key)) {
      fail('Do not put credentials or session tokens in a routine URL. Use a managed integration instead.');
    }
  }

  url.hostname = hostname;
  url.hash = '';
  return url.toString();
}

function isPublicIp(address) {
  const family = net.isIP(String(address || ''));
  if (family !== 4 && family !== 6) return false;
  // Keep families isolated: Node's BlockList can treat IPv4-mapped IPv6 entries as matches in an IPv4 check.
  // IPv4-mapped IPv6 literals remain blocked by the IPv6 ::ffff:0:0/96 deny range.
  return family === 4
    ? !blockedIPv4Addresses.check(address, 'ipv4')
    : !blockedIPv6Addresses.check(address, 'ipv6');
}

async function resolvePublicHttpsTarget(value, lookup = dns.lookup) {
  const normalized = validateHttpsTarget(value);
  if (!normalized) return null;

  let records;
  try {
    records = await lookup(new URL(normalized).hostname, { all: true, verbatim: true });
  } catch (_) {
    fail('The routine target hostname could not be verified through DNS.');
  }
  if (!Array.isArray(records) || !records.length) {
    fail('The routine target hostname did not resolve to a public address.');
  }
  // Reject mixed public/private DNS answers too; never silently choose the public one.
  if (records.some(record => !record || !isPublicIp(record.address))) {
    fail('The routine target resolves to a private or reserved network address and was blocked.');
  }
  return normalized;
}

module.exports = { validateHttpsTarget, isPublicIp, resolvePublicHttpsTarget };
