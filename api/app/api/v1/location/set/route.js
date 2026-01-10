import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

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
    const { location_hash_100m, location_hash_500m, location_hash_1km, location_hash_3km, location_hash_5km, timestamp, meta } = body || {};

    // Validate all five location grid identifiers (format: gridLat_gridLon_gridSize)
    const hashes = { location_hash_100m, location_hash_500m, location_hash_1km, location_hash_3km, location_hash_5km };
    for (const [key, hash] of Object.entries(hashes)) {
      if (!hash || typeof hash !== 'string' || hash.length === 0) {
        return NextResponse.json(
          { error: `Invalid ${key}`, code: 'invalid_hash' },
          { status: 400 },
        );
      }
    }

    const now = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    // Upsert user location with all five hashes
    const { data, error } = await supabaseAdmin
      .from('user_locations')
      .upsert(
        {
          user_id: user.id,
          location_hash_100m,
          location_hash_500m,
          location_hash_1km,
          location_hash_3km,
          location_hash_5km,
          updated_at: now,
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

    // Update user's last_online timestamp
    await supabaseAdmin
      .from('users')
      .update({ last_online: now })
      .eq('id', user.id);

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


