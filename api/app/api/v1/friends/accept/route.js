import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export async function POST(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required', code: 'bad_request' }, { status: 400 });
    }

    const { data: reqRow, error: fetchErr } = await supabaseAdmin
      .from('friend_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[friends/accept] fetch', fetchErr);
      return NextResponse.json({ error: 'Failed to fetch request', code: 'supabase_error' }, { status: 500 });
    }
    if (!reqRow || reqRow.to_user_id !== user.id) {
      return NextResponse.json({ error: 'Request not found', code: 'not_found' }, { status: 404 });
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: 'Request not pending', code: 'invalid_status' }, { status: 400 });
    }

    const [u1, u2] = orderPair(reqRow.from_user_id, reqRow.to_user_id);
    const { data: friendRow, error: friendErr } = await supabaseAdmin
      .from('friends')
      .insert({ user_id_1: u1, user_id_2: u2 })
      .select('id')
      .single();

    if (friendErr) {
      console.error('[friends/accept] insert friend', friendErr);
      return NextResponse.json({ error: 'Failed to create friendship', code: 'create_failed' }, { status: 500 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', id);
    if (updateErr) {
      console.error('[friends/accept] update request', updateErr);
    }

    return NextResponse.json({ success: true, friendship_id: friendRow.id });
  } catch (err) {
    console.error('[friends/accept] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


