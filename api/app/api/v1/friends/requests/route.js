import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function GET(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('friend_requests')
      .select('id, from_user_id, to_user_id, status, created_at, users_from:from_user_id(username, real_name, avatar_url), users_to:to_user_id(username, real_name, avatar_url)')
      .eq('status', 'pending')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[friends/requests] fetch', error);
      return NextResponse.json({ error: 'Failed to fetch requests', code: 'supabase_error' }, { status: 500 });
    }

    const incoming = [];
    const outgoing = [];
    for (const r of data || []) {
      const rUser = r.from_user_id === user.id ? r.users_to : r.users_from;
      const item = {
        id: r.id,
        user_id: r.from_user_id === user.id ? r.to_user_id : r.from_user_id,
        username: rUser?.username,
        real_name: rUser?.real_name,
        avatar_url: rUser?.avatar_url,
        status: r.status,
        created_at: r.created_at,
      };
      if (r.to_user_id === user.id) incoming.push(item);
      if (r.from_user_id === user.id) outgoing.push(item);
    }

    return NextResponse.json({ incoming, outgoing });
  } catch (err) {
    console.error('[friends/requests] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


