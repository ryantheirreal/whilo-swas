'use strict';
const crypto = require('node:crypto');
const { send, authenticate, organizationFor, db, readJson, appUrl, supabaseUrl, serviceKey, sha256Hex, audit, safeError } = require('../../../api/_lib/platform');

function makeToken() { return crypto.randomBytes(32).toString('base64url'); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const orgId = member.organization_id;
    const body = await readJson(req, 8192);
    const action = String(body.action || 'create');

    if (action === 'accept') {
      const token = String(body.token || '');
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return send(res, 400, { error: 'Invitation token is invalid or missing' });
      const result = await db('rpc/accept_workspace_invitation', {
        method: 'POST',
        body: JSON.stringify({ p_user_id: user.id, p_token_hash: sha256Hex(token) })
      });
      const row = Array.isArray(result) ? result[0] : result;
      if (!row || !row.organization_id) throw new Error('Invitation could not be accepted');
      await audit(row.organization_id, user.id, 'workspace.invitation_accepted', 'workspace_invitation', null, 'success', { email: user.email });
      return send(res, 200, {
        ok: true, organizationId: row.organization_id, organizationName: row.organization_name,
        role: row.member_role, detail: 'You joined ' + row.organization_name + '. Reload Messages to see its people and conversations.'
      });
    }

    if (action !== 'create') return send(res, 400, { error: 'Unsupported invitation action' });
    if (!['owner','admin'].includes(member.role)) return send(res, 403, { error: 'Only workspace owners and admins can invite people' });
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) return send(res, 400, { error: 'Enter a valid email address' });
    if (email === String(user.email || '').toLowerCase()) return send(res, 400, { error: 'You are already signed in to this workspace' });

    const profiles = await db('profiles?email=eq.' + encodeURIComponent(email) + '&select=id,email&limit=1');
    if (Array.isArray(profiles) && profiles.length) {
      const existing = await db('organization_members?organization_id=eq.' + encodeURIComponent(orgId) +
        '&user_id=eq.' + encodeURIComponent(profiles[0].id) + '&select=user_id&limit=1');
      if (Array.isArray(existing) && existing.length) return send(res, 409, { error: 'That email already belongs to a member of this workspace' });
    }

    const token = makeToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inserted = await db('workspace_invitations', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: orgId,
        email_normalized: email,
        invited_by: user.id,
        intended_role: 'member',
        token_hash: sha256Hex(token),
        status: 'pending',
        expires_at: expiresAt
      })
    });
    const invite = Array.isArray(inserted) ? inserted[0] : null;
    if (!invite || !invite.id) throw new Error('Invitation record was not persisted');

    const redirectTo = new URL('/', appUrl());
    redirectTo.searchParams.set('whilo_invite', token);
    let emailed = false;
    let actionLink = '';
    let existingAccount = false;
    try {
      const response = await fetch(supabaseUrl() + '/auth/v1/invite?redirect_to=' + encodeURIComponent(redirectTo.toString()), {
        method: 'POST',
        headers: {
          apikey: serviceKey(),
          Authorization: 'Bearer ' + serviceKey(),
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ email, data: { workspace_name: 'Whilo', invited_by_email: user.email } })
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        emailed = true;
        actionLink = typeof result.action_link === 'string' ? result.action_link : '';
      } else if (response.status === 422 || response.status === 409) {
        existingAccount = true;
      } else {
        console.error('[whilo-invite] Supabase invite email request failed:', response.status);
      }
    } catch (error) {
      console.error('[whilo-invite] Supabase invite request failed:', error && error.message ? error.message.slice(0,120) : 'unknown');
    }

    await audit(orgId, user.id, 'workspace.invitation_created', 'workspace_invitation', invite.id, 'success', {
      email, expires_at: expiresAt, email_sent: emailed
    });

    return send(res, 201, {
      ok: true,
      invitationId: invite.id,
      email,
      expiresAt,
      emailed,
      existingAccount,
      inviteUrl: actionLink || redirectTo.toString(),
      detail: emailed
        ? 'Invitation email requested. You can also share the secure link with the intended person.'
        : existingAccount
          ? 'An account may already exist for this email. Share the secure link; the recipient must sign in with the same email to accept.'
          : 'Invitation saved, but Supabase did not confirm email delivery. You can share the secure link with the intended person.',
      warning: !emailed
    });
  } catch (error) {
    return safeError(res, error);
  }
};
