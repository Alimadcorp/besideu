import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

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

    // Fetch current user's location hashes
    const { data: locationRow, error: locErr } = await supabaseAdmin
      .from('user_locations')
      .select('location_hash_100m, location_hash_500m, location_hash_1km, location_hash_3km, location_hash_5km')
      .eq('user_id', user.id)
      .maybeSingle();

    if (locErr) {
      console.error('[location/find] Error fetching current user location', locErr);
      return NextResponse.json(
        { error: 'Failed to fetch current location', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (!locationRow?.location_hash_100m || !locationRow?.location_hash_500m || !locationRow?.location_hash_1km || !locationRow?.location_hash_3km || !locationRow?.location_hash_5km) {
      return NextResponse.json(
        { error: 'Current user location not set', code: 'location_not_set' },
        { status: 400 },
      );
    }

    const myHashes = {
      hash_100m: locationRow.location_hash_100m,
      hash_500m: locationRow.location_hash_500m,
      hash_1km: locationRow.location_hash_1km,
      hash_3km: locationRow.location_hash_3km,
      hash_5km: locationRow.location_hash_5km,
    };

    // 1. Fetch current user's accepted friends IDs
    const { data: friendRows, error: friendErr } = await supabaseAdmin
      .from('friends')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

    if (friendErr) {
      console.error('[location/find] Error fetching friends', friendErr);
      return NextResponse.json({ error: 'Internal error', code: 'supabase_error' }, { status: 500 });
    }

    const friendIds = (friendRows || []).map(row =>
      row.user_id_1 === user.id ? row.user_id_2 : row.user_id_1
    );

    if (friendIds.length === 0) {
      return NextResponse.json({
        users: [],
        pagination: { page: 1, page_size: pageSizeParam || 50, total: 0 }
      });
    }

    // 2. Fetch friends with location data (fetch all friends, we'll filter by hash match in memory)
    const { data: candidates, error: candidatesErr } = await supabaseAdmin
      .from('user_locations')
      .select('user_id, updated_at, location_hash_100m, location_hash_500m, location_hash_1km, location_hash_3km, location_hash_5km, users!inner ( username, real_name, preferences, avatar_url, is_online, last_online )')
      .neq('user_id', user.id)
      .in('user_id', friendIds);

    if (candidatesErr) {
      console.error('[location/find] Error fetching nearby users', candidatesErr);
      return NextResponse.json(
        { error: 'Failed to fetch nearby users', code: 'supabase_error' },
        { status: 500 },
      );
    }

    const users = [];

    for (const row of candidates || []) {
      // Filter out users who disabled location sharing
      if (row.users?.preferences?.share_location === false) continue;

      // Determine distance tier based on which hash matches (check from smallest to largest)
      // If hash_100m matches -> beside_you (100m)
      // Else if hash_500m matches -> very_near (500m)
      // Else if hash_1km matches -> near (1km)
      // Else if hash_3km matches -> far (3km)
      // Else if hash_5km matches -> very_far (5km)
      // If none match, skip this user (they're not nearby)
      let distance = null;
      if (row.location_hash_100m === myHashes.hash_100m) {
        distance = 'beside_you';
      } else if (row.location_hash_500m === myHashes.hash_500m) {
        distance = 'very_near';
      } else if (row.location_hash_1km === myHashes.hash_1km) {
        distance = 'near';
      } else if (row.location_hash_3km === myHashes.hash_3km) {
        distance = 'far';
      } else if (row.location_hash_5km === myHashes.hash_5km) {
        distance = 'very_far';
      } else {
        // No hash matches, user is outside 5km radius
        continue;
      }

      users.push({
        id: row.user_id,
        username: row.users?.username || null,
        real_name: row.users?.real_name || null,
        avatar_url: row.users?.avatar_url || null,
        distance,
        is_online: row.users?.is_online || false,
        last_online: row.users?.last_online || null,
        location_shared_at: row.updated_at,
      });
    }

    // Optionally filter by friend status etc. (placeholder for now)
    // if (filter === 'friends_only') { ... }

    // Users in same region, no specific sort order available by distance
    // Could sort by recently active if updated_at was fetched

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


