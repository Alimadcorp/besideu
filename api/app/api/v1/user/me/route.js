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
            }
        });
    } catch (err) {
        console.error('[user/me] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
