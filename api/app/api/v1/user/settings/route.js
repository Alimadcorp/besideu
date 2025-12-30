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
        const { real_name, email, preferences, avatar_url, expo_push_token } = body;

        // Fetch current user from DB to get firebase_uid
        const { data: dbUser, error: dbErr } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (dbErr || !dbUser) {
            return NextResponse.json({ error: 'User not found', code: 'not_found' }, { status: 404 });
        }

        const updates = {};
        if (real_name !== undefined) updates.real_name = real_name;
        if (email !== undefined) updates.email = email;
        if (preferences !== undefined) updates.preferences = preferences;
        if (avatar_url !== undefined) updates.avatar_url = avatar_url;
        if (expo_push_token !== undefined) updates.expo_push_token = expo_push_token;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update', code: 'bad_request' }, { status: 400 });
        }

        // Sync with Firebase if email or name changes
        if ((email && email !== dbUser.email) || (real_name && real_name !== dbUser.real_name)) {
            const admin = getFirebaseAdmin();
            if (admin && dbUser.firebase_uid) {
                try {
                    const fbUpdate = {};
                    if (email && email !== dbUser.email) {
                        fbUpdate.email = email;
                        fbUpdate.emailVerified = false;
                    }
                    if (real_name && real_name !== dbUser.real_name) {
                        fbUpdate.displayName = real_name;
                    }
                    await admin.auth().updateUser(dbUser.firebase_uid, fbUpdate);
                } catch (fbErr) {
                    console.error('[user/settings] Firebase sync failed', fbErr);
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
