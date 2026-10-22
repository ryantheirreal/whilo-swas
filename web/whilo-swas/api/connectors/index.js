'use strict';
const {
  send, authenticate, organizationFor, db, readJson, encryptPayload, decryptPayload,
  audit, safeError
} = require('../_lib/platform');

const CATALOG = [
  { id: 'slack', name: 'Slack', category: 'Messaging', method: 'OAuth 2.0', capabilities: ['Read approved workspace metadata', 'Post only with a separate approval policy'], status: 'available' },
  { id: 'twilio', name: 'SMS via Twilio', category: 'Messaging', method: 'API key', capabilities: ['Verify provider credentials', 'Messaging Service required before sending'], status: 'available' },
  { id: 'imessage-bridge', name: 'iMessage via Mac Bridge', category: 'Messaging', method: 'Pair a user-owned macOS bridge', capabilities: ['Pairing foundation only', 'Requires the native bridge runtime'], status: 'bridge_required' },
  { id: 'github', name: 'GitHub', category: 'Engineering', method: 'OAuth / GitHub App', capabilities: ['Repository and issue workflows'], status: 'planned' },
  { id: 'gmail', name: 'Gmail & Calendar', category: 'Email & calendar', method: 'Google OAuth', capabilities: ['Read and draft; send requires approval'], status: 'planned' },
  { id: 'microsoft', name: 'Microsoft 365', category: 'Email & calendar', method: 'Microsoft OAuth', capabilities: ['Outlook, calendar and files'], status: 'planned' },
  { id: 'notion', name: 'Notion', category: 'Knowledge', method: 'OAuth', capabilities: ['Search and draft workspace pages'], status: 'planned' },
  { id: 'linear', name: 'Linear', category: 'Engineering', method: 'OAuth', capabilities: ['Issues, projects and status updates'], status: 'planned' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', method: 'OAuth', capabilities: ['Contacts, companies and CRM drafts'], status: 'planned' },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', method: 'OAuth', capabilities: ['CRM records with least-privilege scopes'], status: 'planned' }
];

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const orgId = member.organization_id;

    if (req.method === 'GET') {
      const rows = await db('integration_connections?organization_id=eq.' + encodeURIComponent(orgId) +
        '&select=id,provider,status,external_account_id,external_account_name,scopes,metadata,connected_at,last_verified_at,revoked_at&order=connected_at.desc');
      const connected = Array.isArray(rows) ? rows : [];
      const integrations = CATALOG.map(item => {
        const matches = connected.filter(row => row.provider === item.id && row.status !== 'revoked');
        const selected = matches[0] || null;
        return Object.assign({}, item, {
          state: selected ? selected.status : (item.status === 'planned' ? 'not_configured' : item.status === 'bridge_required' ? 'bridge_required' : 'not_connected'),
          accountName: selected ? selected.external_account_name : null,
          scopes: selected ? selected.scopes : [],
          lastVerifiedAt: selected ? selected.last_verified_at : null,
          connectionId: selected ? selected.id : null
        });
      });
      return send(res, 200, { integrations, workspaceRole: member.role });
    }

    const body = await readJson(req);
    if (body.action === 'connect_twilio') {
      const accountSid = String(body.accountSid || '').trim();
      const apiKeySid = String(body.apiKeySid || '').trim();
      const apiKeySecret = String(body.apiKeySecret || '');
      const messagingServiceSid = String(body.messagingServiceSid || '').trim();
      if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid) || !/^SK[a-fA-F0-9]{32}$/.test(apiKeySid) ||
          apiKeySecret.length < 20 || apiKeySecret.length > 256 || !/^MG[a-fA-F0-9]{32}$/.test(messagingServiceSid)) {
        return send(res, 400, { error: 'Enter a valid Twilio Account SID, API Key SID, API Key Secret and Messaging Service SID.' });
      }
      const auth = Buffer.from(apiKeySid + ':' + apiKeySecret, 'utf8').toString('base64');
      const check = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(accountSid) + '.json', {
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/json' }
      });
      if (!check.ok) return send(res, 400, { error: 'Twilio could not verify those credentials. Check the account and API key in Twilio Console.' });
      const account = await check.json();
      if (account.sid !== accountSid || !['active', 'suspended', 'closed'].includes(String(account.status || '').toLowerCase()) ||
          String(account.status || '').toLowerCase() !== 'active') {
        return send(res, 400, { error: 'The Twilio account is not active for messaging.' });
      }

      const encrypted = encryptPayload({ kind: 'twilio_api_key', accountSid, apiKeySid, apiKeySecret, messagingServiceSid });
      const externalId = accountSid + ':' + apiKeySid;
      await db('integration_connections?on_conflict=organization_id,provider,external_account_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(Object.assign({
          organization_id: orgId,
          provider: 'twilio',
          status: 'connected',
          external_account_id: externalId,
          external_account_name: 'Twilio · ' + accountSid.slice(0, 6) + '…',
          scopes: ['sms:send'],
          metadata: { messaging_service_sid: messagingServiceSid, tested_at: new Date().toISOString() },
          created_by: user.id,
          connected_at: new Date().toISOString(),
          revoked_at: null
        }, encrypted))
      });
      await audit(orgId, user.id, 'connector.connected', 'integration_connection', 'twilio', 'success', { provider: 'twilio', method: 'api_key' });
      return send(res, 200, {
        ok: true,
        provider: 'twilio',
        status: 'connected',
        detail: 'Credentials verified and stored encrypted. This tests the connection only; no SMS was sent.'
      });
    }

    if (body.action === 'disconnect') {
      const provider = String(body.provider || '').trim();
      if (!CATALOG.some(item => item.id === provider)) return send(res, 400, { error: 'Unknown connector' });
      const rows = await db('integration_connections?organization_id=eq.' + encodeURIComponent(orgId) +
        '&provider=eq.' + encodeURIComponent(provider) + '&select=id,external_account_id,encrypted_payload,encryption_iv,encryption_tag&limit=1');
      if (!Array.isArray(rows) || !rows.length) return send(res, 404, { error: 'No active connection was found' });
      const connection = rows[0];

      if (provider === 'slack') {
        const secret = decryptPayload(connection);
        const revoke = await fetch('https://slack.com/api/auth.revoke', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + secret.access_token, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'test=false'
        });
        const result = await revoke.json();
        if (!revoke.ok || (!result.ok && result.error !== 'invalid_auth' && result.error !== 'token_revoked')) {
          return send(res, 502, { error: 'Slack could not confirm token revocation. The local connection was left in place.' });
        }
      }
      await db('integration_connections?id=eq.' + encodeURIComponent(connection.id) +
        '&organization_id=eq.' + encodeURIComponent(orgId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await audit(orgId, user.id, 'connector.disconnected', 'integration_connection', provider, 'success', { provider });
      return send(res, 200, {
        ok: true, provider,
        detail: provider === 'twilio'
          ? 'Whilo removed the encrypted credentials. Revoke the API key in Twilio Console too if you no longer need it.'
          : 'The connection was removed and the Slack token was revoked.'
      });
    }

    return send(res, 400, { error: 'Unsupported connector action' });
  } catch (error) {
    return safeError(res, error);
  }
};
