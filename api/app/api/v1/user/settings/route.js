import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function PUT(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { real_name, email, preferences } = body;

        const updates = {};
        if (real_name !== undefined) updates.real_name = real_name;
        if (email !== undefined) updates.email = email;
        if (preferences !== undefined) updates.preferences = preferences;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update', code: 'bad_request' }, { status: 400 });
        }

        const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', user.id)
            .select('*')
            .single();

        if (updateError) {
            console.error('[user/settings] update', updateError);
            return NextResponse.json({ error: 'Failed to update settings', code: 'supabase_error' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: updatedUser.id,
                phone: updatedUser.phone,
                username: updatedUser.username,
                real_name: updatedUser.real_name,
                email: updatedUser.email,
                preferences: updatedUser.preferences,
            }
        });
    } catch (err) {
        console.error('[user/settings] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
