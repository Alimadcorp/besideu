import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebaseAdmin';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { signAuthToken } from '../../../../lib/jwt';
import { hashPhone } from '../../../../lib/crypto';

export async function POST(req) {
  try {
    const body = await req.json();
    const { firebase_token: firebaseToken, username, real_name: realName, email } = body || {};

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
    const picture = decoded.picture; // PFP from Firebase

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
          email: existingUserByPhone.email,
          avatar_url: existingUserByPhone.avatar_url,
          real_name: existingUserByPhone.real_name,
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

    // Hash phone for discovery privacy
    const phoneHash = hashPhone(phone);

    // Sync email to Firebase if provided
    if (email) {
      try {
        await admin.auth().updateUser(firebaseUid, {
          email: email,
          emailVerified: false,
          displayName: realName,
        });
      } catch (fbErr) {
        console.error('[auth/signup] Firebase email sync failed', fbErr);
        // We continue even if Firebase sync fails, as the Supabase record is primary for our app
      }
    }

    const { data: newUser, error: insertErr } = await supabaseAdmin
      .from('users')
      .insert({
        phone,
        phone_hash: phoneHash,
        username,
        real_name: realName,
        firebase_uid: firebaseUid,
        email: email || null,
        avatar_url: picture || null,
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
        email: newUser.email,
        avatar_url: newUser.avatar_url,
        real_name: newUser.real_name,
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
