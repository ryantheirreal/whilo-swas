'use strict';
const { send } = require('./_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  const configured = {
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    connectorEncryptionKey: Boolean(process.env.WHILO_CONNECTOR_ENCRYPTION_KEY),
    oauthStateSecret: Boolean(process.env.WHILO_OAUTH_STATE_SECRET),
    slackOAuth: Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_REDIRECT_URI),
    publicUrl: Boolean(process.env.WHILO_PUBLIC_URL)
  };
  const ready = configured.supabaseUrl && configured.supabaseAnonKey && configured.serviceRoleKey && configured.connectorEncryptionKey;
  return send(res, ready ? 200 : 503, {
    service: 'whilo-platform-api',
    status: ready ? 'configured' : 'configuration_required',
    configuration: configured,
    capabilities: {
      identity: Boolean(configured.supabaseUrl && configured.supabaseAnonKey),
      connectorCatalog: Boolean(ready),
      slackOAuth: Boolean(ready && configured.slackOAuth && configured.oauthStateSecret && configured.publicUrl),
      smsCredentialVerification: Boolean(ready),
      bridgePairing: Boolean(ready),
      durableMissionQueue: Boolean(ready),
      autonomousWorker: false,
      nativeImessageTransport: false
    },
    security: { secretsExposed: false, noCredentialsAreReturned: true }
  });
};
