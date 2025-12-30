import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';
import { getFirebaseAdmin } from '../../../../../lib/firebaseAdmin';

export async function POST(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('firebase_uid, email')
            .eq('id', user.id)
            .single();

        if (!dbUser?.email || !dbUser?.firebase_uid) {
            return NextResponse.json({ error: 'Email or Firebase UID missing', code: 'bad_request' }, { status: 400 });
        }

        const admin = getFirebaseAdmin();
        if (!admin) {
            return NextResponse.json({ error: 'Firebase Admin not configured', code: 'server_error' }, { status: 500 });
        }

        // Generate the verification link. 
        // In a real app, you would send this link via SendGrid, Mailgun, etc.
        // For now, we generate it. If we had an emailer setup, we'd call it here.
        const link = await admin.auth().generateEmailVerificationLink(dbUser.email);

        console.log(`[resend-verification] Link for ${dbUser.email}: ${link}`);

        // Since we don't have a mailer yet, we'll return success if the link was generated.
        // In a production environment, this link should NEVER be returned to the client 
        // to prevent verification bypass if someone sniffs the traffic. 
        // But for development/debugging, it's useful.

        return NextResponse.json({
            success: true,
            message: 'Verification email triggered (simulated)',
            // link: link // Uncomment only for debugging
        });
    } catch (err) {
        console.error('[resend-verification] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
