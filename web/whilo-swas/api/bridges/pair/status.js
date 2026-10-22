'use strict';
const { send, authenticate, organizationFor, db, safeError } = require('../../_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const url = new URL(req.url, 'https://whilo.invalid');
    const id = String(url.searchParams.get('id') || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: 'Pairing session ID is invalid' });
    const rows = await db('bridge_pair_sessions?id=eq.' + encodeURIComponent(id) +
      '&organization_id=eq.' + encodeURIComponent(member.organization_id) +
      '&select=id,status,device_name,expires_at,paired_at&limit=1');
    if (!Array.isArray(rows) || !rows.length) return send(res, 404, { error: 'Pairing session was not found' });
    const row = rows[0];
    const state = row.status === 'pending' && Date.parse(row.expires_at) <= Date.now() ? 'expired' : row.status;
    return send(res, 200, { id: row.id, status: state, deviceName: row.device_name, expiresAt: row.expires_at, pairedAt: row.paired_at });
  } catch (error) {
    return safeError(res, error);
  }
};
