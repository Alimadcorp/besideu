import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebaseAdmin';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { signAuthToken } from '../../../../lib/jwt';

export async function POST(req) {
  try {
    const body = await req.json();
    const { firebase_token: firebaseToken, username, real_name: realName } = body || {};

    if (!firebaseToken || !username || !realName) {
      return NextResponse.json(
        { error: 'firebase_token, username and real_name are required', code: 'bad_request' },
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

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const phone = decoded.phone_number;
    const firebaseUid = decoded.uid;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number not found in Firebase token', code: 'phone_missing' },
        { status: 400 },
      );
    }

    const { data: existingUserByPhone, error: existingPhoneErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (existingPhoneErr) {
      console.error('[auth/signup] Error checking existing user by phone', existingPhoneErr);
      return NextResponse.json(
        { error: 'Internal error', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (existingUserByPhone) {
      const token = signAuthToken({
        sub: existingUserByPhone.id,
        phone: existingUserByPhone.phone,
        username: existingUserByPhone.username,
      });

      return NextResponse.json({
        success: true,
        token,
        user: {
          id: existingUserByPhone.id,
          phone: existingUserByPhone.phone,
          username: existingUserByPhone.username,
        },
      });
    }

    const { data: existingUserByUsername, error: existingUsernameErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUsernameErr) {
      console.error('[auth/signup] Error checking existing user by username', existingUsernameErr);
      return NextResponse.json(
        { error: 'Internal error', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (existingUserByUsername) {
      return NextResponse.json(
        { error: 'Username already taken', code: 'username_taken' },
        { status: 409 },
      );
    }

    const { data: newUser, error: insertErr } = await supabaseAdmin
      .from('users')
      .insert({
        phone,
        username,
        real_name: realName,
        firebase_uid: firebaseUid,
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('[auth/signup] Failed to create user', insertErr);
      return NextResponse.json(
        { error: 'Failed to create user', code: 'create_failed' },
        { status: 500 },
      );
    }

    const token = signAuthToken({
      sub: newUser.id,
      phone: newUser.phone,
      username: newUser.username,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        phone: newUser.phone,
        username: newUser.username,
      },
    });
  } catch (err) {
    console.error('[auth/signup] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}


