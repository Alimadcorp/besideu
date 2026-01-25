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
    const { location_hash_3km, timestamp, meta } = body || {};

    // Validate 3km location hash
    if (!location_hash_3km || typeof location_hash_3km !== 'string' || location_hash_3km.length === 0) {
      return NextResponse.json(
        { error: 'Invalid location_hash_3km', code: 'invalid_hash' },
        { status: 400 },
      );
    }

    const now = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    // Get previous location to detect changes
    const { data: prevLocation } = await supabaseAdmin
      .from('user_locations')
      .select('location_hash_3km')
      .eq('user_id', user.id)
      .maybeSingle();

    const previousHash = prevLocation?.location_hash_3km;
    const locationChanged = previousHash !== location_hash_3km;

    // Upsert user location with 3km hash only
    const { data, error } = await supabaseAdmin
      .from('user_locations')
      .upsert(
        {
          user_id: user.id,
          location_hash_3km,
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

    // Update user's last_online timestamp (don't await, fire and forget)
    supabaseAdmin
      .from('users')
      .update({ last_online: now })
      .eq('id', user.id)
      .then(() => {})
      .catch(err => console.error('[location/set] Error updating last_online', err));

    // Return response immediately
    const response = NextResponse.json({
      success: true,
      updated_at: data.updated_at,
    });

    // Send notifications asynchronously (don't block response)
    if (locationChanged) {
      // Fire and forget - run in background
      (async () => {
        try {
          const { sendPushNotifications } = await import('../../../../../lib/pushNotifications');
          
          // Find friends
          const { data: friends } = await supabaseAdmin
            .from('friends')
            .select('user_id_1, user_id_2')
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

          if (friends && friends.length > 0) {
            const friendIds = friends.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1);
            
            // Get all friend locations (both old and new location)
            const { data: allFriendLocations } = await supabaseAdmin
              .from('user_locations')
              .select('user_id, location_hash_3km, users!inner(expo_push_token, preferences)')
              .in('user_id', friendIds);

            if (allFriendLocations && allFriendLocations.length > 0) {
              // Get user info for notification
              const { data: userInfo } = await supabaseAdmin
                .from('users')
                .select('real_name, username')
                .eq('id', user.id)
                .single();

              const userName = userInfo?.real_name || userInfo?.username || 'Someone';
              
              // Find friends who are NOW in range (in new location) but WEREN'T before (not in previous location)
              const friendsNowInRange = allFriendLocations
                .filter(fl => fl.location_hash_3km === location_hash_3km && fl.users?.preferences?.share_location !== false);
              
              const friendsPreviouslyInRange = previousHash 
                ? allFriendLocations.filter(fl => fl.location_hash_3km === previousHash && fl.users?.preferences?.share_location !== false)
                : [];
              
              const previouslyInRangeIds = new Set(friendsPreviouslyInRange.map(f => f.user_id));
              const newlyInRange = friendsNowInRange.filter(f => !previouslyInRangeIds.has(f.user_id));
              
              // Notify friends about this user entering their range
              const friendIdsToNotify = newlyInRange
                .filter(fl => fl.users?.expo_push_token)
                .map(fl => fl.user_id);
              
              if (friendIdsToNotify.length > 0) {
                await sendPushNotifications(friendIdsToNotify, {
                  title: `${userName} is nearby`,
                  body: `${userName} is within 3km of you`,
                  data: { type: 'user_nearby', user_id: user.id }
                });
              }

              // Find friends who are in the new location (for notifying this user)
              const nearbyFriendIds = friendsNowInRange.map(fl => fl.user_id);
              const previouslyNearbyIds = new Set(friendsPreviouslyInRange.map(f => f.user_id));
              const newlyNearbyForUser = nearbyFriendIds.filter(id => !previouslyNearbyIds.has(id));

              if (newlyNearbyForUser.length > 0) {
                // Get friend names
                const { data: nearbyFriends } = await supabaseAdmin
                  .from('users')
                  .select('id, real_name, username')
                  .in('id', newlyNearbyForUser);

                const friendNames = nearbyFriends?.map(f => f.real_name || f.username).filter(Boolean) || [];
                const friendCount = friendNames.length;
                
                const { data: currentUser } = await supabaseAdmin
                  .from('users')
                  .select('expo_push_token')
                  .eq('id', user.id)
                  .single();

                if (currentUser?.expo_push_token) {
                  await sendPushNotifications([user.id], {
                    title: friendCount === 1 
                      ? `${friendNames[0]} is nearby`
                      : `${friendCount} friends nearby`,
                    body: friendCount === 1
                      ? `${friendNames[0]} is within 3km of you`
                      : `${friendNames.slice(0, 2).join(', ')}${friendCount > 2 ? ` and ${friendCount - 2} more` : ''} are nearby`,
                    data: { type: 'friends_nearby', friend_ids: newlyNearbyForUser }
                  });
                }
              }
            }
          }
        } catch (notifError) {
          console.error('[location/set] Error sending notifications', notifError);
          // Don't fail the request if notifications fail
        }
      })();
    }

    return response;
  } catch (err) {
    console.error('[location/set] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}


