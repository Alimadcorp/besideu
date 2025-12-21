import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function GET(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const after = searchParams.get('after');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  // Pagination
  let limit = Number(limitParam);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 100);
  const offset = Number.isFinite(Number(offsetParam)) && Number(offsetParam) >= 0 ? Number(offsetParam) : 0;

  try {
    // Query friends table
    let query = supabaseAdmin
      .from('friends')
      .select('id, user_id_1, user_id_2, last_message, last_message_at, unread_count_1, unread_count_2')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (after) {
      query = query.gt('last_message_at', after);
    }

    const { data: friendRows, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[messages/list] fetch', error);
      return NextResponse.json({ error: 'Failed to fetch messages', code: 'supabase_error' }, { status: 500 });
    }

    if (!friendRows || friendRows.length === 0) {
       return NextResponse.json({
          dms: [],
          pagination: { limit, offset, returned: 0 }
       });
    }

    // Resolve other users
    const otherUserIds = new Set();
    friendRows.forEach(row => {
      const otherId = row.user_id_1 === user.id ? row.user_id_2 : row.user_id_1;
      otherUserIds.add(otherId);
    });

    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .in('id', Array.from(otherUserIds));
    
    const userMap = {};
    if (usersData) {
      usersData.forEach(u => userMap[u.id] = u);
    }

    // Build response
    const dms = friendRows.map(row => {
      const isUser1 = row.user_id_1 === user.id;
      const otherId = isUser1 ? row.user_id_2 : row.user_id_1;
      const otherUser = userMap[otherId] || { id: otherId, username: 'Unknown' };
      const unread = isUser1 ? row.unread_count_1 : row.unread_count_2;

      return {
        id: row.id,
        user_id: otherUser.id,
        username: otherUser.username,
        last_message: {
          text: row.last_message || '',
          timestamp: row.last_message_at || row.created_at, // fallback
        },
        unread_count: unread || 0,
        updated_at: row.last_message_at || row.created_at
      };
    });

    return NextResponse.json({
      dms,
      pagination: {
        limit,
        offset,
        returned: dms.length,
      },
    });
  } catch (err) {
    console.error('[messages/list] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


