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
        const {
            real_name, email, preferences, avatar_url, expo_push_token,
            bio, website, business_type, public_phone, status, status_expiration, is_business,
            scheduled_status, scheduled_status_at, scheduled_status_expiration
        } = body;

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
        if (bio !== undefined) updates.bio = bio;
        if (website !== undefined) updates.website = website;
        if (business_type !== undefined) updates.business_type = business_type;
        if (public_phone !== undefined) updates.public_phone = public_phone;
        if (status !== undefined) updates.status = status;
        if (status_expiration !== undefined) updates.status_expiration = status_expiration;
        if (is_business !== undefined) updates.is_business = is_business;
        if (scheduled_status !== undefined) updates.scheduled_status = scheduled_status;
        if (scheduled_status_at !== undefined) updates.scheduled_status_at = scheduled_status_at;
        if (scheduled_status_expiration !== undefined) updates.scheduled_status_expiration = scheduled_status_expiration;

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
                bio: updatedUser.bio,
                website: updatedUser.website,
                business_type: updatedUser.business_type,
                public_phone: updatedUser.public_phone,
                status: updatedUser.status,
                status_expiration: updatedUser.status_expiration,
                is_business: updatedUser.is_business,
                is_online: updatedUser.is_online,
                last_online: updatedUser.last_online,
            }
        });
    } catch (err) {
        console.error('[user/settings] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
