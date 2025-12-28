import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function POST(req, { params }) {
    const { id: meetupId } = await params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }



    try {
        const { action, location } = await req.json();
        if (!['accepted', 'declined'].includes(action)) {
            return NextResponse.json({ error: 'action must be accepted or declined', code: 'bad_request' }, { status: 400 });
        }

        // Fetch meetup
        const { data: meetup, error: fetchErr } = await supabaseAdmin
            .from('meetups')
            .select('*')
            .eq('id', meetupId)
            .single();

        if (fetchErr || !meetup) {
            return NextResponse.json({ error: 'Meetup request not found', code: 'not_found' }, { status: 404 });
        }

        if (meetup.requested_from !== user.id) {
            return NextResponse.json({ error: 'Unauthorized to respond to this request', code: 'forbidden' }, { status: 403 });
        }

        if (meetup.status !== 'pending') {
            return NextResponse.json({ error: 'Meetup is no longer pending', code: 'invalid_status' }, { status: 400 });
        }

        const updates = { status: action };
        if (action === 'accepted' && location) {
            updates.location = location;
        }

        const { error: updateErr } = await supabaseAdmin
            .from('meetups')
            .update(updates)
            .eq('id', meetupId);

        if (updateErr) {
            console.error('[meetups/respond] update', updateErr);
            return NextResponse.json({ error: 'Failed to update meetup status', code: 'supabase_error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, status: action });
    } catch (err) {
        console.error('[meetups/respond] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
