(function () {
  'use strict';

  const STORAGE_KEY = 'sb-whilo-auth-token';
  let configPromise = null;

  function readStoredSession() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || typeof value !== 'object') return null;
      const session = value.currentSession && typeof value.currentSession === 'object' ? value.currentSession : value;
      if (!session.access_token || !session.refresh_token) return null;
      return session;
    } catch (_) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function saveSession(session) {
    if (!session || typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') {
      throw new Error('Supabase returned an incomplete sign-in session.');
    }
    const expiresIn = Number(session.expires_in) || 3600;
    const normalized = Object.assign({}, session, {
      expires_at: Number(session.expires_at) || Math.floor(Date.now() / 1000) + expiresIn
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); }
    catch (_) { throw new Error('This browser could not securely retain a session. Check browser storage settings.'); }
    return normalized;
  }

  async function publicConfig(forceReload) {
    if (forceReload) configPromise = null;
    if (!configPromise) {
      configPromise = fetch('/api/public-config', { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(async function (response) {
          let data = {};
          try { data = await response.json(); } catch (_) {}
          if (!response.ok || !data.configured || !data.supabaseUrl || !data.supabaseAnonKey) {
            throw new Error(data.note || 'Cloud sign-in is not configured for this Whilo deployment yet.');
          }
          const parsed = new URL(data.supabaseUrl);
          if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('The cloud authentication endpoint must use HTTPS.');
          return { url: parsed.origin.replace(/\/+$/, ''), anonKey: data.supabaseAnonKey };
        })
        .catch(function (error) { configPromise = null; throw error; });
    }
    return configPromise;
  }

  async function authRequest(endpoint, payload, accessToken) {
    const config = await publicConfig(false);
    const headers = { apikey: config.anonKey, Accept: 'application/json', 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    const response = await fetch(config.url + endpoint, {
      method: 'POST', headers, body: JSON.stringify(payload || {}), cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = String(data.msg || data.message || data.error_description || data.error || 'Cloud authentication failed.');
      if (response.status === 400 && /invalid login credentials/i.test(message)) throw new Error('Email or password is incorrect.');
      if (response.status === 429) throw new Error('Too many sign-in attempts. Wait a little and retry.');
      throw new Error(message.slice(0, 320));
    }
    return data;
  }

  async function refreshSession(session) {
    try {
      const refreshed = await authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      return saveSession(refreshed);
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  function consumeAuthRedirect() {
    try {
      const raw = String(window.location.hash || '').replace(/^#/, '');
      if (!raw || !/access_token=/.test(raw) || !/refresh_token=/.test(raw)) return;
      const params = new URLSearchParams(raw);
      const accessToken = params.get('access_token') || '';
      const refreshToken = params.get('refresh_token') || '';
      if (!accessToken || !refreshToken) return;
      const expiresIn = Number(params.get('expires_in')) || 3600;
      const expiresAt = Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + expiresIn;
      saveSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: params.get('token_type') || 'bearer',
        expires_in: expiresIn,
        expires_at: expiresAt
      });
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = '';
      window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
    } catch (_) {
      // Do not log auth fragments or tokens. An unparseable redirect can be retried via sign-in.
    }
  }

  async function getAccessToken() {
    let session = readStoredSession();
    if (!session) return '';
    const expiry = Number(session.expires_at) || 0;
    if (expiry > Math.floor(Date.now() / 1000) + 60) return session.access_token;
    session = await refreshSession(session);
    return session.access_token;
  }

  async function signIn(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || !password) {
      throw new Error('Enter the workspace email and password.');
    }
    const data = await authRequest('/auth/v1/token?grant_type=password', { email: normalizedEmail, password });
    saveSession(data);
    return { email: data.user && data.user.email ? data.user.email : normalizedEmail, id: data.user && data.user.id ? data.user.id : '' };
  }

  async function signOut() {
    const session = readStoredSession();
    try {
      if (session && session.access_token) {
        const config = await publicConfig(false);
        await fetch(config.url + '/auth/v1/logout', {
          method: 'POST',
          headers: { apikey: config.anonKey, Authorization: 'Bearer ' + session.access_token },
          cache: 'no-store'
        });
      }
    } finally { clearSession(); }
  }

  async function getSession() {
    const token = await getAccessToken();
    if (!token) return null;
    const config = await publicConfig(false);
    const response = await fetch(config.url + '/auth/v1/user', {
      headers: { apikey: config.anonKey, Authorization: 'Bearer ' + token, Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) {
      clearSession();
      return null;
    }
    const user = await response.json();
    return user && user.id ? { id: user.id, email: user.email || '' } : null;
  }

  consumeAuthRedirect();

  window.WhiloCloudAuth = Object.freeze({
    publicConfig: publicConfig,
    getAccessToken: getAccessToken,
    getSession: getSession,
    signIn: signIn,
    signOut: signOut
  });
})();
