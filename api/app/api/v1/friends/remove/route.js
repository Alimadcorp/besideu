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

    // delete friend_request by id if owned
    const { data: reqRow } = await supabaseAdmin.from('friend_requests').select('*').eq('id', id).maybeSingle();
    if (reqRow && (reqRow.from_user_id === user.id || reqRow.to_user_id === user.id)) {
      await supabaseAdmin.from('friend_requests').delete().eq('id', id);
      return NextResponse.json({ success: true });
    }

    // delete friendship by id
    await supabaseAdmin.from('friends').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[friends/remove] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


