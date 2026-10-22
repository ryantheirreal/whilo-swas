'use strict';
const { redirect, appUrl, requiredEnv, db, sha256Hex, encryptPayload, audit, safeError } = require('../../_lib/platform');

function returnToApp(res, result) {
  const target = new URL('/', appUrl());
  target.searchParams.set('whilo_connect', result);
  return redirect(res, target.toString());
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  try {
    requiredEnv('SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_REDIRECT_URI', 'WHILO_PUBLIC_URL', 'WHILO_CONNECTOR_ENCRYPTION_KEY');
    if (process.env.SLACK_REDIRECT_URI !== appUrl() + '/api/connectors/slack/callback') {
      const error = new Error('Slack callback URL is not configured correctly');
      error.statusCode = 503;
      throw error;
    }

    const url = new URL(req.url, appUrl());
    const state = url.searchParams.get('state') || '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(state)) return returnToApp(res, 'slack_error');
    const consumed = await db('rpc/consume_oauth_state', {
      method: 'POST',
      body: JSON.stringify({ p_state_hash: sha256Hex(state), p_provider: 'slack' })
    });
    if (!Array.isArray(consumed) || consumed.length !== 1) return returnToApp(res, 'slack_expired');

    if (url.searchParams.has('error')) return returnToApp(res, 'slack_cancelled');
    const code = url.searchParams.get('code') || '';
    if (!code || code.length > 2048) return returnToApp(res, 'slack_error');

    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(process.env.SLACK_CLIENT_ID + ':' + process.env.SLACK_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({ code, redirect_uri: process.env.SLACK_REDIRECT_URI })
    });
    const grant = await tokenResponse.json();
    if (!tokenResponse.ok || !grant.ok || !grant.access_token || !grant.team || !grant.team.id) {
      console.error('[whilo-slack-oauth] Slack token exchange failed:', String(grant.error || tokenResponse.status).slice(0, 100));
      return returnToApp(res, 'slack_error');
    }

    const owner = consumed[0];
    const encrypted = encryptPayload({
      kind: 'slack_bot_token',
      access_token: grant.access_token,
      token_type: grant.token_type || 'bot',
      bot_user_id: grant.bot_user_id || null
    });
    const scopes = typeof grant.scope === 'string' ? grant.scope.split(',').filter(Boolean) : [];
    await db('integration_connections?on_conflict=organization_id,provider,external_account_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(Object.assign({
        organization_id: owner.organization_id,
        provider: 'slack',
        status: 'connected',
        external_account_id: grant.team.id,
        external_account_name: String(grant.team.name || 'Slack workspace').slice(0, 180),
        scopes,
        metadata: { team_id: grant.team.id, bot_user_id: grant.bot_user_id || null },
        created_by: owner.user_id,
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        revoked_at: null
      }, encrypted))
    });
    await audit(owner.organization_id, owner.user_id, 'connector.connected', 'integration_connection', 'slack', 'success', {
      provider: 'slack', workspace_id: grant.team.id, granted_scopes: scopes
    });
    return returnToApp(res, 'slack_success');
  } catch (error) {
    return safeError(res, error);
  }
};
