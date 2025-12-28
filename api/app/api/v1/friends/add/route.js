import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export async function POST(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user');
    if (!targetUserId) {
      return NextResponse.json({ error: 'user is required', code: 'bad_request' }, { status: 400 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'cannot friend yourself', code: 'invalid_target' }, { status: 400 });
    }

    // check if already friends
    const [u1, u2] = orderPair(user.id, targetUserId);
    const { data: existingFriend, error: friendErr } = await supabaseAdmin
      .from('friends')
      .select('id')
      .eq('user_id_1', u1)
      .eq('user_id_2', u2)
      .maybeSingle();
    if (friendErr) {
      console.error('[friends/add] check friends', friendErr);
      return NextResponse.json({ error: 'Internal error', code: 'supabase_error' }, { status: 500 });
    }
    if (existingFriend) {
      return NextResponse.json({ error: 'Already friends', code: 'already_friends' }, { status: 409 });
    }

    // check duplicate pending
    const { data: existingReq, error: reqErr } = await supabaseAdmin
      .from('friend_requests')
      .select('id,status,from_user_id')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.id})`)
      .maybeSingle();

    if (reqErr) {
      console.error('[friends/add] check request', reqErr);
      return NextResponse.json({ error: 'Internal error', code: 'supabase_error' }, { status: 500 });
    }

    if (existingReq) {
      if (existingReq.status === 'accepted') {
        return NextResponse.json({ error: 'Already friends', code: 'already_friends' }, { status: 409 });
      }
      if (existingReq.status === 'pending') {
        if (existingReq.from_user_id === user.id) {
          return NextResponse.json({ error: 'Request already pending', code: 'request_exists' }, { status: 409 });
        } else {
          // Implicitly accept the INCOMING request from the target user
          const [u1, u2] = orderPair(user.id, targetUserId);
          const { data: friendRow, error: friendErr } = await supabaseAdmin
            .from('friends')
            .insert({ user_id_1: u1, user_id_2: u2 })
            .select('id')
            .single();

          if (friendErr) {
            return NextResponse.json({ error: 'Failed to accept mutual request', code: 'create_failed' }, { status: 500 });
          }

          await supabaseAdmin
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', existingReq.id);

          return NextResponse.json({ success: true, friendship_id: friendRow.id, message: 'Mutual request accepted' });
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('friend_requests')
      .insert({
        from_user_id: user.id,
        to_user_id: targetUserId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[friends/add] insert request', error);
      return NextResponse.json({ error: 'Failed to create request', code: 'create_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, request_id: data.id });
  } catch (err) {
    console.error('[friends/add] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


