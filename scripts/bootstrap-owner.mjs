#!/usr/bin/env node
'use strict';

// Provision the owner via Supabase Auth Admin API. Never write credentials to source control or SQL.
const email = String(process.env.WHILO_OWNER_EMAIL || 'ryantheirreal@gmail.com').trim().toLowerCase();
const password = process.env.WHILO_OWNER_INITIAL_PASSWORD || '';
const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!base || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your secret manager first.');
  process.exit(1);
}
if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error('WHILO_OWNER_EMAIL must be a valid email address.');
  process.exit(1);
}
if (password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  console.error('WHILO_OWNER_INITIAL_PASSWORD must be at least 14 characters and include upper/lowercase letters, a number and a symbol. The short password shared in chat is not accepted.');
  process.exit(1);
}

(async () => {
  const response = await fetch(base + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Whilo Owner', company_name: 'Whilo' }
    })
  });

  if (!response.ok) {
    const status = response.status;
    // Never print the request body, password or full provider response.
    if (status === 422 || status === 409) {
      console.error('Supabase rejected the new user; this often means the account already exists. No password reset was attempted.');
    } else {
      console.error('Supabase Auth could not create the owner account (HTTP ' + status + '). Check project configuration and Auth logs.');
    }
    process.exit(1);
  }

  const result = await response.json();
  console.log(JSON.stringify({
    created: true,
    userId: result.id,
    email: result.email,
    emailConfirmed: Boolean(result.email_confirmed_at),
    workspaceProvisioning: 'The database trigger creates the initial Whilo workspace and owner membership after the migration is installed.'
  }, null, 2));
})().catch(() => {
  console.error('Owner provisioning failed. Check SUPABASE_URL, the service-role key and network access.');
  process.exit(1);
});
