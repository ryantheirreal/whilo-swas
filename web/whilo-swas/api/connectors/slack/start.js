'use strict';
const crypto = require('node:crypto');
const { send, authenticate, organizationFor, db, appUrl, requiredEnv, hmacHex, safeError } = require('../../_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    requiredEnv('SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_REDIRECT_URI', 'WHILO_OAUTH_STATE_SECRET', 'WHILO_CONNECTOR_ENCRYPTION_KEY');
    const expectedRedirect = appUrl() + '/api/connectors/slack/callback';
    if (process.env.SLACK_REDIRECT_URI !== expectedRedirect) {
      const error = new Error('SLACK_REDIRECT_URI must exactly match the Whilo callback URL');
      error.statusCode = 503;
      throw error;
    }

    const rawState = crypto.randomBytes(32).toString('base64url');
    await db('oauth_states', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        state_hash: hmacHex(rawState, process.env.WHILO_OAUTH_STATE_SECRET),
        provider: 'slack',
        organization_id: member.organization_id,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      })
    });

    const authorize = new URL('https://slack.com/oauth/v2/authorize');
    authorize.searchParams.set('client_id', process.env.SLACK_CLIENT_ID);
    authorize.searchParams.set('scope', 'chat:write,channels:read');
    authorize.searchParams.set('redirect_uri', process.env.SLACK_REDIRECT_URI);
    authorize.searchParams.set('state', rawState);
    return send(res, 200, { authorizeUrl: authorize.toString(), expiresInSeconds: 600 });
  } catch (error) {
    return safeError(res, error);
  }
};
