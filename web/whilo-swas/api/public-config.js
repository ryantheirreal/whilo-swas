'use strict';
const { send } = require('./_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  // The Supabase anon/publishable key is intended for browser use and is safe to expose.
  // The service-role key, encryption key and OAuth client secret are never returned here.
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  let supabaseUrl = null;
  if (configured) {
    try {
      const parsed = new URL(process.env.SUPABASE_URL);
      if (parsed.protocol === 'https:' || parsed.hostname === 'localhost') supabaseUrl = parsed.origin;
    } catch (_) {}
  }
  const anonKey = configured && supabaseUrl ? process.env.SUPABASE_ANON_KEY : null;
  return send(res, configured && supabaseUrl ? 200 : 503, {
    configured: Boolean(anonKey),
    supabaseUrl,
    supabaseAnonKey: anonKey,
    signInEnabled: Boolean(anonKey),
    note: anonKey ? 'Use the public anon key with Supabase Auth; all privileged operations stay server-side.' : 'The workspace owner must configure the Supabase URL and anon key in the server environment.'
  });
};
