'use strict';
const { send, authenticate, organizationFor, db, safeError } = require('../_lib/platform');

function inFilter(values) { return 'in.(' + values.map(String).join(',') + ')'; }

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const user = await authenticate(req);
    const member = await organizationFor(user);
    const url = new URL(req.url, 'https://whilo.invalid');
    const q = String(url.searchParams.get('q') || '').trim().replace(/^@/,'').slice(0, 50);
    if (q && !/^[a-z0-9 _.-]+$/i.test(q)) return send(res, 400, { error: 'Search people by Whilo username or display name' });

    const memberships = await db('organization_members?organization_id=eq.' + encodeURIComponent(member.organization_id) +
      '&select=user_id&limit=1000');
    const workspaceUserIds = [...new Set((Array.isArray(memberships) ? memberships : []).map(row => row.user_id).filter(id => id !== user.id))];
    if (!workspaceUserIds.length) return send(res, 200, { people: [] });

    let profiles;
    if (q) {
      const pattern = '*' + encodeURIComponent(q.replace(/[*(),]/g,'')) + '*';
      const query = 'human_profiles?searchable=eq.true&or=' + encodeURIComponent('(username.ilike.' + pattern + ',display_name.ilike.' + pattern + ')') +
        '&id=' + inFilter(workspaceUserIds) +
        '&select=id,username,display_name,avatar_url,presence,last_seen_at&order=display_name.asc&limit=30';
      profiles = await db(query);
    } else {
      const ids = workspaceUserIds.slice(0, 30);
      profiles = await db('human_profiles?searchable=eq.true&id=' + inFilter(ids) +
        '&select=id,username,display_name,avatar_url,presence,last_seen_at&order=display_name.asc&limit=30');
    }

    return send(res, 200, {
      people: (Array.isArray(profiles) ? profiles : []).map(profile => ({
        id: profile.id, username: profile.username, display_name: profile.display_name,
        avatar_url: profile.avatar_url, presence: profile.presence, last_seen_at: profile.last_seen_at
      }))
    });
  } catch (error) {
    return safeError(res, error);
  }
};
