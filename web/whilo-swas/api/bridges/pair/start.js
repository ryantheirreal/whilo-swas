'use strict';
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { send, authenticate, organizationFor, db, appUrl, sha256Hex, safeError } = require('../../_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const result = await db('bridge_pair_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: member.organization_id,
        requested_by: user.id,
        token_hash: sha256Hex(token),
        status: 'pending',
        expires_at: expiresAt
      })
    });
    if (!Array.isArray(result) || !result[0] || !result[0].id) throw new Error('Could not create a pairing session');

    const deepLink = 'whilo-bridge://pair?server=' + encodeURIComponent(appUrl()) + '&token=' + encodeURIComponent(token);
    const qrDataUrl = await QRCode.toDataURL(deepLink, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#111827', light: '#FFFFFF' }
    });
    await db('audit_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        organization_id: member.organization_id,
        actor_id: user.id,
        action: 'bridge.pairing_started',
        resource_type: 'bridge_pair_session',
        resource_id: result[0].id,
        outcome: 'success',
        detail: { expires_at: expiresAt }
      })
    });
    return send(res, 200, {
      pairingSessionId: result[0].id,
      qrDataUrl,
      deepLink,
      expiresAt,
      expiresInSeconds: 300,
      caveat: 'This QR establishes device identity only. A compatible native macOS bridge and its message transport must be installed before iMessage actions can run.'
    });
  } catch (error) {
    return safeError(res, error);
  }
};
