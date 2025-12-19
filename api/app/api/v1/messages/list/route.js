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

  try {
    // Pull latest message per dm_id where user participated as sender
    let query = supabaseAdmin
      .from('messages')
      .select('dm_id, text:last_message, timestamp:last_timestamp')
      .eq('sender_id', user.id);

    if (after) {
      query = query.gte('timestamp', after);
    }

    let limit = Number(limitParam);
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    limit = Math.min(limit, 100);

    const offset = Number.isFinite(Number(offsetParam)) && Number(offsetParam) >= 0 ? Number(offsetParam) : 0;

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      console.error('[messages/list] fetch', error);
      return NextResponse.json({ error: 'Failed to fetch messages', code: 'supabase_error' }, { status: 500 });
    }

    // Build DM summary list
    const dms = [];
    const seen = new Set();
    for (const row of data || []) {
      if (seen.has(row.dm_id)) continue;
      seen.add(row.dm_id);
      dms.push({
        id: row.dm_id,
        user_id: null, // receiver unknown in schema; client should map
        username: null,
        last_message: {
          text: row.text,
          timestamp: row.timestamp,
        },
        unread_count: 0,
        updated_at: row.timestamp,
      });
    }

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


