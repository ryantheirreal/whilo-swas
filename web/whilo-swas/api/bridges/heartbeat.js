'use strict';
const { send, db, sha256Hex, readJson, safeError } = require('../_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const authorization = String(req.headers.authorization || '');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const secret = match ? match[1].trim() : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(secret)) return send(res, 401, { error: 'Bridge authentication required' });
    const body = await readJson(req, 4096);
    const rows = await db('bridge_devices?credential_hash=eq.' + encodeURIComponent(sha256Hex(secret)) +
      '&status=eq.active&select=id,organization_id,device_name&limit=1');
    if (!Array.isArray(rows) || rows.length !== 1) return send(res, 401, { error: 'Bridge credential is invalid or revoked' });
    await db('bridge_devices?id=eq.' + encodeURIComponent(rows[0].id), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        last_seen_at: new Date().toISOString(),
        metadata: { last_reported_platform: String(body.platform || 'unknown').slice(0, 60), heartbeat_version: 1 }
      })
    });
    return send(res, 200, { ok: true, deviceId: rows[0].id, deviceName: rows[0].device_name, capabilities: ['heartbeat'] });
  } catch (error) {
    return safeError(res, error);
  }
};
