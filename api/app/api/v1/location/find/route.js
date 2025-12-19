import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';
import { decodeGeohash, distanceKm, getGeohashPrefixLengthForRange } from '../../../../../lib/geohashUtils';

export async function GET(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get('range');
    const filter = searchParams.get('filter') || null;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('page_size') || searchParams.get('limit');

    const rangeKm = Number.isFinite(Number(rangeParam)) && Number(rangeParam) > 0
      ? Number(rangeParam)
      : null;

    // Get current user preferences (for default range)
    let effectiveRangeKm = rangeKm;
    if (!effectiveRangeKm) {
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();

      if (userErr) {
        console.error('[location/find] Error fetching user preferences', userErr);
      }

      const defaultRange = userRow?.preferences?.range;
      effectiveRangeKm = typeof defaultRange === 'number' && defaultRange > 0 ? defaultRange : 5;
    }

    // Get current user location
    const { data: locationRow, error: locErr } = await supabaseAdmin
      .from('user_locations')
      .select('geohash')
      .eq('user_id', user.id)
      .maybeSingle();

    if (locErr) {
      console.error('[location/find] Error fetching current user location', locErr);
      return NextResponse.json(
        { error: 'Failed to fetch current location', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (!locationRow?.geohash) {
      return NextResponse.json(
        { error: 'Current user location not set', code: 'location_not_set' },
        { status: 400 },
      );
    }

    const originHash = locationRow.geohash;
    const originCoords = decodeGeohash(originHash);
    if (!originCoords) {
      return NextResponse.json(
        { error: 'Failed to decode current location geohash', code: 'decode_error' },
        { status: 500 },
      );
    }

    const prefixLen = getGeohashPrefixLengthForRange(effectiveRangeKm);
    const prefix = originHash.slice(0, prefixLen);

    // Fetch candidate users with similar geohash prefix
    const { data: candidates, error: candidatesErr } = await supabaseAdmin
      .from('user_locations')
      .select('user_id, geohash, users ( username )')
      .neq('user_id', user.id)
      .like('geohash', `${prefix}%`);

    if (candidatesErr) {
      console.error('[location/find] Error fetching nearby users', candidatesErr);
      return NextResponse.json(
        { error: 'Failed to fetch nearby users', code: 'supabase_error' },
        { status: 500 },
      );
    }

    const users = [];

    for (const row of candidates || []) {
      const coords = decodeGeohash(row.geohash);
      if (!coords) continue;

      const dist = distanceKm(
        originCoords.lat,
        originCoords.lon,
        coords.lat,
        coords.lon,
      );

      if (dist <= effectiveRangeKm) {
        users.push({
          id: row.user_id,
          username: row.users?.username || null,
          distance: dist,
          geohash: row.geohash,
        });
      }
    }

    // Optionally filter by friend status etc. (placeholder for now)
    // if (filter === 'friends_only') { ... }

    // Sort by distance ascending
    users.sort((a, b) => a.distance - b.distance);

    // Simple pagination on the in-memory list
    const pageSize = Math.max(1, Math.min(100, Number(pageSizeParam) || 50));
    const page = Math.max(1, Number(pageParam) || 1);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paged = users.slice(start, end);

    return NextResponse.json({
      users: paged,
      pagination: {
        page,
        page_size: pageSize,
        total: users.length,
      },
    });
  } catch (err) {
    console.error('[location/find] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}


