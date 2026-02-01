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

    // Fetch current user's 3km location hash
    const { data: locationRow, error: locErr } = await supabaseAdmin
      .from('user_locations')
      .select('location_hash_3km')
      .eq('user_id', user.id)
      .maybeSingle();

    if (locErr) {
      console.error('[location/find] Error fetching current user location', locErr);
      return NextResponse.json(
        { error: 'Failed to fetch current location', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (!locationRow?.location_hash_3km) {
      return NextResponse.json(
        { error: 'Current user location not set', code: 'location_not_set' },
        { status: 400 },
      );
    }

    const myHash3km = locationRow.location_hash_3km;

    // Optimize: Fetch friends and nearby users in parallel
    const [friendResult, candidatesResult] = await Promise.all([
      // 1. Fetch current user's accepted friends IDs
      supabaseAdmin
        .from('friends')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),

      // 2. Fetch users with 3km location hash match (business users first, we'll add friends)
      supabaseAdmin
        .from('user_locations')
        .select('user_id, updated_at, location_hash_3km, users!inner ( username, real_name, preferences, avatar_url, is_online, last_online, is_business )')
        .neq('user_id', user.id)
        .eq('location_hash_3km', myHash3km)
        .eq('users.is_business', true)
    ]);

    const { data: friendRows, error: friendErr } = friendResult;
    const { data: businessCandidates, error: businessErr } = candidatesResult;

    if (friendErr) {
      console.error('[location/find] Error fetching friends', friendErr);
      return NextResponse.json({ error: 'Internal error', code: 'supabase_error' }, { status: 500 });
    }

    if (businessErr) {
      console.error('[location/find] Error fetching business users', businessErr);
    }

    const friendIds = (friendRows || []).map(row =>
      row.user_id_1 === user.id ? row.user_id_2 : row.user_id_1
    );

    // Fetch friend locations if we have friends
    let allCandidates = businessCandidates || [];
    if (friendIds.length > 0) {
      const { data: friendLocations, error: friendLocErr } = await supabaseAdmin
        .from('user_locations')
        .select('user_id, updated_at, location_hash_3km, users!inner ( username, real_name, preferences, avatar_url, is_online, last_online, is_business )')
        .neq('user_id', user.id)
        .eq('location_hash_3km', myHash3km)
        .in('user_id', friendIds);

      if (!friendLocErr && friendLocations) {
        // Merge and deduplicate by user_id
        const candidateMap = new Map();
        allCandidates.forEach(c => candidateMap.set(c.user_id, c));
        friendLocations.forEach(f => candidateMap.set(f.user_id, f));
        allCandidates = Array.from(candidateMap.values());
      }
    }

    if (businessErr) {
      console.error('[location/find] Error fetching business users', businessErr);
      return NextResponse.json(
        { error: 'Failed to fetch business users', code: 'supabase_error' },
        { status: 500 },
      );
    }

    const users = [];

    for (const row of allCandidates) {
      // Filter out users who disabled location sharing
      if (row.users?.preferences?.share_location === false) continue;

      // All users in this list are within 3km (since we filtered by hash match)
      const isFriend = friendIds.includes(row.user_id);
      const isBusiness = row.users?.is_business === true;

      users.push({
        id: row.user_id,
        username: row.users?.username || null,
        real_name: row.users?.real_name || null,
        avatar_url: row.users?.avatar_url || null,
        distance: 'near', // All are within 3km
        is_online: row.users?.is_online || false,
        last_online: row.users?.last_online || null,
        location_shared_at: row.updated_at,
        is_business: isBusiness,
        is_friend: isFriend,
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


