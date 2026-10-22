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

  let created = false;
  if (response.ok) {
    await response.json();
    created = true;
  } else if (response.status !== 409 && response.status !== 422) {
    console.error('Supabase Auth could not create the owner account (HTTP ' + response.status + '). Check project configuration and Auth logs.');
    process.exit(1);
  }
  // On conflict, do not change the existing password. The RPC verifies the exact email
  // against auth.users and idempotently ensures a workspace plus the six default Pets.
  const provision = await fetch(base + '/rest/v1/rpc/ensure_owner_workspace', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_email: email })
  });
  if (!provision.ok) {
    console.error('The owner identity could not be verified or its workspace could not be provisioned. Confirm all four migrations were applied.');
    process.exit(1);
  }
  const rows = await provision.json();
  const owner = Array.isArray(rows) ? rows[0] : rows;
  if (!owner || !owner.user_id || !owner.organization_id) {
    console.error('Supabase did not return an owner workspace. Check migration status.');
    process.exit(1);
  }
  console.log(JSON.stringify({
    createdUser: created,
    passwordChanged: created,
    userId: owner.user_id,
    email,
    organizationId: owner.organization_id,
    role: owner.role,
    workspaceCreated: Boolean(owner.created_workspace),
    defaultPetsSeeded: ['Whilo', 'Fynn', 'Nori', 'Capuccino', 'Ollie', 'Pico']
  }, null, 2));
})().catch(() => {
  console.error('Owner provisioning failed. Check Supabase configuration and network access.');
  process.exit(1);
});
