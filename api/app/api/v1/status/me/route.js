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

        // Fetch active statuses (not expired) and also future scheduled ones
        const { data, error } = await supabaseAdmin
            .from('user_statuses')
            .select('*, users!inner(id, username, real_name, avatar_url)')
            .eq('user_id', user.id)
            .gt('expires_at', now)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[status/me] db error', error);
            return NextResponse.json({ error: 'Failed to fetch statuses', code: 'db_error' }, { status: 500 });
        }

        // Get view counts
        const statusIds = data.map(s => s.id);
        if (statusIds.length > 0) {
            const { data: viewCounts, error: viewError } = await supabaseAdmin
                .from('status_views')
                .select('status_id')
                .in('status_id', statusIds);

            if (!viewError && viewCounts) {
                const viewsMap = viewCounts.reduce((acc, curr) => {
                    acc[curr.status_id] = (acc[curr.status_id] || 0) + 1;
                    return acc;
                }, {});

                data.forEach(s => {
                    s.view_count = viewsMap[s.id] || 0;
                });
            }
        }

        // Format response with user info
        const formattedStatuses = data.map(s => ({
            ...s,
            user: s.users || { id: user.id, username: user.username, real_name: user.real_name, avatar_url: user.avatar_url },
            user_id: user.id
        }));

        return NextResponse.json({ statuses: formattedStatuses });
    } catch (err) {
        console.error('[status/me] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
