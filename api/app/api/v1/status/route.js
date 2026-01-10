import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../lib/authUser';

export async function POST(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { type, content, media_url, background_color, font_style, scheduled_at } = body;

        if (!type || (!content && !media_url)) {
            return NextResponse.json({ error: 'Missing required fields', code: 'bad_request' }, { status: 400 });
        }

        // Calculate expires_at (24 hours from now or scheduled time)
        const startTime = scheduled_at ? new Date(scheduled_at) : new Date();
        const expiresAt = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

        const { data, error } = await supabaseAdmin
            .from('user_statuses')
            .insert({
                user_id: user.id,
                type,
                content: content || '',
                media_url: media_url || null,
                background_color: background_color || '#000000',
                font_style: font_style || 'normal',
                scheduled_at: scheduled_at || null,
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[status/create] db error', error);
            return NextResponse.json({ error: 'Failed to create status', code: 'db_error' }, { status: 500 });
        }

        return NextResponse.json({ status: data });
    } catch (err) {
        console.error('[status/create] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
