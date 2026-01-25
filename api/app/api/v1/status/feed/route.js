import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function GET(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date().toISOString();

        // 1. Get friend IDs
        const { data: friends, error: friendError } = await supabaseAdmin
            .from('friends')
            .select('user_id_1, user_id_2')
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

        if (friendError) {
            console.error('[status/feed] friend fetch error', friendError);
            throw friendError;
        }

        const friendIds = friends.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1);

        if (friendIds.length === 0) {
            return NextResponse.json({ feed: [] });
        }

        // 2. Fetch statuses from friends
        // Must be active (not expired) AND started (scheduled_at <= now OR is null)
        const { data: statuses, error: statusError } = await supabaseAdmin
            .from('user_statuses')
            .select(`
                *,
                users!inner(id, username, real_name, avatar_url)
            `)
            .in('user_id', friendIds)
            .gt('expires_at', now)
            .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
            .order('created_at', { ascending: false });

        if (statusError) {
            console.error('[status/feed] db error', statusError);
            return NextResponse.json({ error: 'Failed to fetch feed', code: 'db_error' }, { status: 500 });
        }

        // 3. Check for views
        const statusIds = statuses.map(s => s.id);
        const viewedStatusIds = new Set();

        if (statusIds.length > 0) {
            const { data: views } = await supabaseAdmin
                .from('status_views')
                .select('status_id')
                .eq('viewer_id', user.id)
                .in('status_id', statusIds);

            views?.forEach(v => viewedStatusIds.add(v.status_id));
        }

        const feed = statuses.map(s => ({
            ...s,
            user: s.users,
            viewed: viewedStatusIds.has(s.id)
        }));

        return NextResponse.json({ feed });
    } catch (err) {
        console.error('[status/feed] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
