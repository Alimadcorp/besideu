import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';
import { getFirebaseAdmin } from '../../../../../lib/firebaseAdmin';

export async function GET(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const { data: dbUser, error: dbError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (dbError || !dbUser) {
            console.error('[user/me] fetch', dbError);
            return NextResponse.json({ error: 'User not found', code: 'not_found' }, { status: 404 });
        }

        // Lazy Publish Scheduled Status
        const now = new Date();
        if (dbUser.scheduled_status && dbUser.scheduled_status_at && new Date(dbUser.scheduled_status_at) <= now) {
            const { data: updated, error: updateErr } = await supabaseAdmin
                .from('users')
                .update({
                    status: dbUser.scheduled_status,
                    status_expiration: dbUser.scheduled_status_expiration,
                    scheduled_status: null,
                    scheduled_status_at: null,
                    scheduled_status_expiration: null
                })
                .eq('id', dbUser.id)
                .select('*')
                .single();

            if (!updateErr && updated) {
                Object.assign(dbUser, updated);
            }
        }

        let emailVerified = false;
        if (dbUser.firebase_uid) {
            const admin = getFirebaseAdmin();
            if (admin) {
                try {
                    const fbUser = await admin.auth().getUser(dbUser.firebase_uid);
                    emailVerified = fbUser.emailVerified;
                } catch (fbErr) {
                    console.error('[user/me] Firebase check failed', fbErr);
                }
            }
        }

        return NextResponse.json({
            user: {
                id: dbUser.id,
                phone: dbUser.phone,
                username: dbUser.username,
                real_name: dbUser.real_name,
                email: dbUser.email,
                avatar_url: dbUser.avatar_url,
                email_verified: emailVerified,
                preferences: dbUser.preferences || { range: 5 },
                created_at: dbUser.created_at,
                bio: dbUser.bio,
                website: dbUser.website,
                business_type: dbUser.business_type,
                public_phone: dbUser.public_phone,
                status: (dbUser.status_expiration && new Date(dbUser.status_expiration) < new Date()) ? null : dbUser.status,
                status_expiration: dbUser.status_expiration,
                is_business: dbUser.is_business,
                is_online: dbUser.is_online,
                last_online: dbUser.last_online,
            }
        });
    } catch (err) {
        console.error('[user/me] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
