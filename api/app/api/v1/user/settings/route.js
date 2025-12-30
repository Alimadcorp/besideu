import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';
import { getFirebaseAdmin } from '../../../../../lib/firebaseAdmin';

export async function PUT(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { real_name, email, preferences, avatar_url } = body;

        const updates = {};
        if (real_name !== undefined) updates.real_name = real_name;
        if (email !== undefined) updates.email = email;
        if (preferences !== undefined) updates.preferences = preferences;
        if (avatar_url !== undefined) updates.avatar_url = avatar_url;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update', code: 'bad_request' }, { status: 400 });
        }

        // If email is being updated, sync with Firebase
        if (email && email !== user.email) {
            const admin = getFirebaseAdmin();
            if (admin && user.firebase_uid) {
                try {
                    await admin.auth().updateUser(user.firebase_uid, {
                        email: email,
                        emailVerified: false // Reset verification status on email change
                    });
                } catch (fbErr) {
                    console.error('[user/settings] Firebase email sync failed', fbErr);
                }
            }
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
                avatar_url: updatedUser.avatar_url,
                preferences: updatedUser.preferences,
            }
        });
    } catch (err) {
        console.error('[user/settings] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
