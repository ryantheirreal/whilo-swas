'use strict';
const { send, authenticate, organizationFor, db, readJson, audit, safeError } = require('../_lib/platform');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const body = await readJson(req, 8192);
    const missionId = String(body.missionId || '');
    const decision = body.decision === 'approved' || body.decision === 'approve' ? 'approved'
      : body.decision === 'rejected' || body.decision === 'reject' ? 'rejected' : '';
    const reason = String(body.reason || '').trim().slice(0, 1200);
    if (!/^[0-9a-f-]{36}$/i.test(missionId) || !decision) return send(res, 400, { error: 'Provide a valid missionId and decision (approved or rejected)' });
    const result = await db('rpc/decide_mission_bundle', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: member.organization_id,
        p_user_id: user.id,
        p_mission_id: missionId,
        p_decision: decision,
        p_reason: reason
      })
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (!row || !row.mission_id) throw new Error('Mission approval result was not persisted');
    await audit(member.organization_id, user.id, 'mission.' + decision, 'mission', missionId, 'success', { reason });
    return send(res, 200, {
      missionId: row.mission_id,
      state: row.mission_state,
      jobId: row.job_id || null,
      executionStatus: decision === 'approved' ? 'queued_waiting_for_worker' : 'blocked',
      message: decision === 'approved'
        ? 'Approval recorded and job queued. No agent or external action runs until a real worker/provider is configured and reports evidence.'
        : 'Mission blocked. No job was queued.'
    });
  } catch (error) {
    return safeError(res, error);
  }
};
