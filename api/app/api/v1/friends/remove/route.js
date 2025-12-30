import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export async function DELETE(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const targetUserId = searchParams.get('user');

    if (!id && !targetUserId) {
      return NextResponse.json({ error: 'id or user is required', code: 'bad_request' }, { status: 400 });
    }

    // remove friend by friendship id or by user
    if (targetUserId) {
      const [u1, u2] = orderPair(user.id, targetUserId);
      await supabaseAdmin.from('friends').delete().eq('user_id_1', u1).eq('user_id_2', u2);
      await supabaseAdmin
        .from('friend_requests')
        .delete()
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.id})`);
      return NextResponse.json({ success: true });
    }

    if (id) {
      // If it's a friend_request ID
      const { data: reqRow } = await supabaseAdmin.from('friend_requests').select('*').eq('id', id).maybeSingle();
      if (reqRow && (reqRow.from_user_id === user.id || reqRow.to_user_id === user.id)) {
        await supabaseAdmin.from('friends').delete().or(`and(user_id_1.eq.${reqRow.from_user_id},user_id_2.eq.${reqRow.to_user_id}),and(user_id_1.eq.${reqRow.to_user_id},user_id_2.eq.${reqRow.from_user_id})`);
        await supabaseAdmin.from('friend_requests').delete().eq('id', id);
        return NextResponse.json({ success: true });
      }

      // If it's a friendship ID
      const { data: friendRow } = await supabaseAdmin.from('friends').select('*').eq('id', id).maybeSingle();
      if (friendRow && (friendRow.user_id_1 === user.id || friendRow.user_id_2 === user.id)) {
        await supabaseAdmin.from('friend_requests').delete().or(`and(from_user_id.eq.${friendRow.user_id_1},to_user_id.eq.${friendRow.user_id_2}),and(from_user_id.eq.${friendRow.user_id_2},to_user_id.eq.${friendRow.user_id_1})`);
        await supabaseAdmin.from('friends').delete().eq('id', id);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Not found or not authorized', code: 'not_found' }, { status: 404 });
  } catch (err) {
    console.error('[friends/remove] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


