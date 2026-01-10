import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function POST(req, { params }) {
    const { id } = params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const { error } = await supabaseAdmin
            .from('status_views')
            .upsert({ status_id: id, viewer_id: user.id }, { onConflict: 'status_id,viewer_id' });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[status/view] error', err);
        return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
    }
}
