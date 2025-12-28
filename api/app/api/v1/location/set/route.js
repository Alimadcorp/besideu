import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

function isValidGeohash(geohash) {
  return typeof geohash === 'string' && geohash.length >= 4 && geohash.length <= 12;
}

export async function PUT(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { location_hash, timestamp, meta } = body || {};

    // Validate location_hash (SHA-256 hex string)
    if (!location_hash || typeof location_hash !== 'string' || location_hash.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid location hash', code: 'invalid_hash' },
        { status: 400 },
      );
    }

    // Upsert user location
    const { data, error } = await supabaseAdmin
      .from('user_locations')
      .upsert(
        {
          user_id: user.id,
          location_hash,
          updated_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('updated_at')
      .single();

    if (error) {
      console.error('[location/set] Failed to upsert location', error);
      return NextResponse.json(
        { error: 'Failed to update location', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      updated_at: data.updated_at,
    });
  } catch (err) {
    console.error('[location/set] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}


