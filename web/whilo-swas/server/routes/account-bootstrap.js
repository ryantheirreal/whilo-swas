'use strict';
const { send, authenticate, db, safeError, audit } = require('../../api/_lib/platform');

module.exports = async function accountBootstrap(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const email = String(user && user.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return send(res, 403, { error: 'A verified workspace email is required.' });
    }
    // The RPC accepts only the email from the validated Supabase session.
    // It never accepts an arbitrary target email from the browser.
    const rows = await db('rpc/ensure_owner_workspace', {
      method: 'POST',
      body: JSON.stringify({ p_email: email })
    });
    const owner = Array.isArray(rows) ? rows[0] : rows;
    if (!owner || !owner.user_id || !owner.organization_id || owner.user_id !== user.id) {
      return send(res, 503, { error: 'Workspace provisioning did not return the signed-in account. Check the migration state.' });
    }
    await audit(owner.organization_id, user.id, 'workspace.bootstrap_completed', 'organization', owner.organization_id, 'success', {
      created_workspace: Boolean(owner.created_workspace)
    });
    return send(res, 200, {
      ok: true,
      userId: owner.user_id,
      organizationId: owner.organization_id,
      role: owner.role,
      workspaceCreated: Boolean(owner.created_workspace),
      petsSeeded: ['Whilo', 'Fynn', 'Nori', 'Capuccino', 'Ollie', 'Pico']
    });
  } catch (error) {
    return safeError(res, error);
  }
};
