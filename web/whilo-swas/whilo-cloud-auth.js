(function () {
  'use strict';

  const STORAGE_KEY = 'sb-whilo-auth-token';
  const OAUTH_ATTEMPT_KEY = 'whilo-google-oauth-attempt';
  let configPromise = null;
  let authRedirectError = null;
  let authRedirectPromise = Promise.resolve();

  function base64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomUrlSafe(byteCount) {
    const bytes = new Uint8Array(byteCount || 32);
    window.crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  function cleanAuthCallbackUrl(url) {
    ['code','state','error','error_description','whilo_provider','whilo_oauth_state'].forEach(function (key) {
      url.searchParams.delete(key);
    });
    url.hash = '';
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  function readStoredSession() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || typeof value !== 'object') return null;
      const session = value.currentSession && typeof value.currentSession === 'object' ? value.currentSession : value;
      if (session.auth_provider === 'chatgpt' && session.access_token && Number(session.expires_at) > 0) return session;
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
          return {
            url: parsed.origin.replace(/\/+$/, ''),
            anonKey: data.supabaseAnonKey,
            chatgptSignInEnabled: data.chatgptSignInEnabled === true
          };
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

  async function consumeAuthRedirect() {
    const callbackUrl = new URL(window.location.href);
    const provider = callbackUrl.searchParams.get('whilo_provider') || '';
    const callbackState = callbackUrl.searchParams.get('whilo_oauth_state') || '';
    const authCode = callbackUrl.searchParams.get('code') || '';
    const callbackError = callbackUrl.searchParams.get('error') || '';
    if (provider || callbackState) {
      let pending = null;
      try { pending = JSON.parse(sessionStorage.getItem(OAUTH_ATTEMPT_KEY) || 'null'); } catch (_) {}
      cleanAuthCallbackUrl(callbackUrl);
      try {
        if (provider !== 'google' || !pending || pending.provider !== 'google' ||
            !callbackState || callbackState !== pending.state ||
            Date.now() - Number(pending.createdAt || 0) > 10 * 60 * 1000 ||
            Date.now() < Number(pending.createdAt || 0) || callbackError || !authCode) {
          throw new Error(callbackError ? 'Google sign-in was cancelled or declined.' : 'Google sign-in could not be verified. Start again.');
        }
        const redirect = new URL(pending.redirectUri);
        if (redirect.origin !== window.location.origin || redirect.pathname !== callbackUrl.pathname) {
          throw new Error('Google sign-in returned to an unexpected address. Start again.');
        }
        const data = await authRequest('/auth/v1/token?grant_type=pkce', { auth_code:authCode, code_verifier:pending.verifier });
        saveSession(data);
        window.dispatchEvent(new CustomEvent('whilo:auth-changed'));
      } catch (error) {
        clearSession();
        authRedirectError = error instanceof Error ? error : new Error('Google sign-in could not be completed.');
      } finally {
        try { sessionStorage.removeItem(OAUTH_ATTEMPT_KEY); } catch (_) {}
      }
      return;
    }

    // Backward-compatible support for legacy Supabase implicit callbacks.
    try {
      const raw = String(window.location.hash || '').replace(/^#/, '');
      if (!raw || !/access_token=/.test(raw) || !/refresh_token=/.test(raw)) return;
      const params = new URLSearchParams(raw);
      const accessToken = params.get('access_token') || '';
      const refreshToken = params.get('refresh_token') || '';
      if (!accessToken || !refreshToken) return;
      const expiresIn = Number(params.get('expires_in')) || 3600;
      const expiresAt = Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + expiresIn;
      saveSession({ access_token:accessToken, refresh_token:refreshToken, token_type:params.get('token_type') || 'bearer', expires_in:expiresIn, expires_at:expiresAt });
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = '';
      window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
    } catch (_) {
      // Never log authentication fragments or tokens.
    }
  }

  async function getAccessToken() {
    await authRedirectPromise;
    if (authRedirectError) throw authRedirectError;
    let session = readStoredSession();
    if (!session) return '';
    const expiry = Number(session.expires_at) || 0;
    if (expiry > Math.floor(Date.now() / 1000) + 60) return session.access_token;
    if (session.auth_provider === 'chatgpt') {
      clearSession();
      throw new Error('Your ChatGPT sign-in expired. Sign in again to continue.');
    }
    session = await refreshSession(session);
    return session.access_token;
  }

  async function signInWithProvider(provider) {
    if (provider !== 'google') throw new Error('This identity provider is not enabled.');
    if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
      throw new Error('This browser does not support secure sign-in. Update the browser and retry.');
    }
    const config = await publicConfig(false);
    const verifier = randomUrlSafe(48);
    const state = randomUrlSafe(32);
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64Url(new Uint8Array(digest));
    const redirectUri = new URL('/', window.location.origin);
    redirectUri.searchParams.set('whilo_provider', provider);
    redirectUri.searchParams.set('whilo_oauth_state', state);
    const currentParams = new URLSearchParams(window.location.search);
    ['whilo_invite','ref'].forEach(function (key) {
      const value = currentParams.get(key);
      if (value && value.length <= 200) redirectUri.searchParams.set(key, value);
    });
    const attempt = { provider:provider, state:state, verifier:verifier, redirectUri:redirectUri.toString(), createdAt:Date.now() };
    try { sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify(attempt)); }
    catch (_) { throw new Error('Secure temporary storage is unavailable. Allow session storage and retry.'); }
    const authorize = new URL(config.url + '/auth/v1/authorize');
    authorize.searchParams.set('provider', 'google');
    authorize.searchParams.set('redirect_to', redirectUri.toString());
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('code_challenge_method', 's256');
    authorize.searchParams.set('scopes', 'openid email profile');
    window.location.assign(authorize.toString());
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

  async function signUp(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string') {
      throw new Error('Enter a valid email and a strong password.');
    }
    if (password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new Error('Use at least 14 characters with uppercase, lowercase, a number and a symbol.');
    }
    const redirect = new URL('/', window.location.origin);
    const invitation = new URLSearchParams(window.location.search).get('whilo_invite');
    if (invitation) redirect.searchParams.set('whilo_invite', invitation);
    const endpoint = '/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect.toString());
    const data = await authRequest(endpoint, {
      email: normalizedEmail,
      password,
      data: { full_name: normalizedEmail.split('@')[0] }
    });
    if (data.access_token && data.refresh_token) saveSession(data);
    return {
      email: data.user && data.user.email ? data.user.email : normalizedEmail,
      id: data.user && data.user.id ? data.user.id : '',
      confirmationRequired: !(data.access_token && data.refresh_token)
    };
  }

  function validateStrongPassword(password) {
    return typeof password === 'string' && password.length >= 14 &&
      /[A-Z]/.test(password) && /[a-z]/.test(password) &&
      /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
  }

  async function resetPasswordForEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.');
    const redirect = new URL('/', window.location.origin);
    redirect.searchParams.set('whilo_recovery', '1');
    await authRequest('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect.toString()), { email: normalizedEmail });
    return { sent: true };
  }

  async function updatePassword(password) {
    if (!validateStrongPassword(password)) {
      throw new Error('Use at least 14 characters with uppercase, lowercase, a number and a symbol.');
    }
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Open the password-reset link from your email again before choosing a new password.');
    const config = await publicConfig(false);
    const response = await fetch(config.url + '/auth/v1/user', {
      method: 'PUT',
      headers: { apikey: config.anonKey, Authorization: 'Bearer ' + accessToken, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = String(data.msg || data.message || data.error_description || data.error || 'Password could not be updated.');
      if (response.status === 429) throw new Error('Too many attempts. Wait a little and retry.');
      throw new Error(message.slice(0, 320));
    }
    return { id: data.id || '', email: data.email || '' };
  }

  async function signOut() {
    const session = readStoredSession();
    if (session && session.auth_provider === 'chatgpt') { clearSession(); return; }
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
    await authRedirectPromise;
    if (authRedirectError) throw authRedirectError;
    const storedSession = readStoredSession();
    if (storedSession && storedSession.auth_provider === 'chatgpt') {
      if (Number(storedSession.expires_at) <= Math.floor(Date.now() / 1000)) { clearSession(); return null; }
      return { id:storedSession.user && storedSession.user.id || '', email:storedSession.user && storedSession.user.email || '', provider:'chatgpt' };
    }
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

  authRedirectPromise = consumeAuthRedirect();

  window.WhiloCloudAuth = Object.freeze({
    publicConfig: publicConfig,
    getAccessToken: getAccessToken,
    getSession: getSession,
    signIn: signIn,
    signInWithProvider: signInWithProvider,
    signUp: signUp,
    resetPasswordForEmail: resetPasswordForEmail,
    updatePassword: updatePassword,
    signOut: signOut
  });
})();
