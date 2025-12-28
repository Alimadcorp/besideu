# Privacy Improvement Tasks

## Location Privacy
- [ ] Design a custom one-way location hash function.
  - Must not be reversible to exact coordinates.
  - Must allow determining if users are in the same region.
- [ ] Update Client:
  - Implement the location hash generation.
  - Update `socket` location updates to send `location_hash`.
  - Update `/v1/location/set` API call to send `location_hash`.
  - Update UI to handle "near|far" distance instead of exact km in `/v1/location/find` results.
- [ ] Update Backend (API & Socket):
  - Refactor data models to use `location_hash` instead of `geohash`.
  - Update `/v1/location/set` to store `location_hash`.
  - Update `/v1/location/find` to use hash comparison logic for proximity.
  - Return "near" or "far" (fuzzy distance) in `/v1/location/find` response.
- [ ] Database:
  - Rename `geohash` column to `location_hash` in `user_locations` table.

## Contact Privacy
- [ ] Implement Phone Hashing Logic:
  - Normalization format: `+Code'nPhone` (e.g. `+24123912319`).
  - Hash the normalized string (SHA-256 or similar).
- [ ] Update Client:
  - Hash all contacts before sending to `/v1/contacts/set`.
  - Ensure raw phone numbers are NEVER sent to the server for contact matching.
- [ ] Update Backend:
  - Handle `phone_hash` in `/v1/contacts/set`.
  - Update matching logic in `/v1/contacts/list` to compare hashes.
  - Ensure server treats phone numbers as hashes in these contexts.
