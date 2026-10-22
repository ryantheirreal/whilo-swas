'use strict';
const crypto = require('node:crypto');
const { send, requiredEnv, db, sha256Hex, safeError } = require('../../_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    requiredEnv('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
    const body = await require('../../_lib/platform').readJson(req, 8192);
    const token = String(body.token || '');
    const deviceName = String(body.deviceName || '').trim();
    const publicKey = String(body.publicKey || '').trim();
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || deviceName.length < 1 || deviceName.length > 120 ||
        publicKey.length < 64 || publicKey.length > 4096) {
      return send(res, 400, { error: 'Pairing token, device name or public key is invalid' });
    }
    const deviceSecret = crypto.randomBytes(32).toString('base64url');
    const claimed = await db('rpc/claim_bridge_pair_session', {
      method: 'POST',
      body: JSON.stringify({
        p_token_hash: sha256Hex(token),
        p_device_name: deviceName,
        p_public_key: publicKey,
        p_credential_hash: sha256Hex(deviceSecret)
      })
    });
    if (!Array.isArray(claimed) || claimed.length !== 1 || !claimed[0].device_id) {
      return send(res, 410, { error: 'Pairing token expired, already used or invalid. Start a new pairing from Whilo.' });
    }
    return send(res, 200, {
      ok: true,
      deviceId: claimed[0].device_id,
      organizationId: claimed[0].organization_id,
      deviceName: claimed[0].device_name,
      deviceSecret,
      storageInstruction: 'Store deviceSecret once in the operating system credential vault. Do not log it or write it to a plain-text config file.'
    });
  } catch (error) {
    return safeError(res, error);
  }
};
