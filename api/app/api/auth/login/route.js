import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebaseAdmin';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { signAuthToken } from '../../../../lib/jwt';

export async function POST(req) {
  try {
    const body = await req.json();
    const { firebase_token: firebaseToken } = body || {};

    if (!firebaseToken) {
      return NextResponse.json(
        { error: 'firebase_token is required', code: 'bad_request' },
        { status: 400 },
      );
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin is not configured', code: 'server_misconfigured' },
        { status: 500 },
      );
    }

    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const phone = decoded.phone_number;
    const firebaseUid = decoded.uid;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number not found in Firebase token', code: 'phone_missing' },
        { status: 400 },
      );
    }

    // Find user by phone or firebase_uid
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`phone.eq.${phone},firebase_uid.eq.${firebaseUid}`)
      .maybeSingle();

    if (error) {
      console.error('[auth/login] Error fetching user', error);
      return NextResponse.json(
        { error: 'Internal error', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please sign up first.', code: 'user_not_found' },
        { status: 404 },
      );
    }

    const token = signAuthToken({
      sub: user.id,
      phone: user.phone,
      username: user.username,
    });

    return NextResponse.json({
      token,
      expires_in: 24 * 60 * 60,
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('[auth/login] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}


