# Database Setup Guide

## Quick Start

### Step 1: Get Your Supabase Credentials
1. Go to https://supabase.com
2. Create a new project or select existing one
3. Go to **Settings** → **API**
4. Copy:
   - Project URL → `acuiwfmxqhbafdyzzqjx.supabase.co`
   - anon/public key → ``  
   - service_role key → `` ⚠️ Keep secret!

### Step 2: Run Migrations in Supabase SQL Editor

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Run each SQL file **in order** (01 through 11):
   - `01_enums.sql`
   - `02_users.sql`
   - `03_user_locations.sql`
   - `04_friends.sql`
   - `05_friend_requests.sql`
   - `06_contacts.sql`
   - `07_messages.sql`
   - `08_message_reactions.sql`
   - `09_meetups.sql`
   - `10_indexes.sql`
   - `11_rls_policies.sql` (see note below)

### Step 3: Verify Setup

Run this query to verify all tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- contacts
- friend_requests
- friends
- meetups
- message_reactions
- messages
- user_locations
- users

### Step 4: Update Environment Variables

Copy your Supabase credentials to:
- `api/.env` (create from `api/env.example.txt`)
- `socket/.env` (create from `socket/env.example.txt`)

---

## Important Notes

### RLS Policies (Row Level Security)

⚠️ **The RLS policies in `11_rls_policies.sql` use `auth.uid()` which requires Supabase Auth.**

Since we're using **Firebase Auth**, these policies won't work. You have two options:

**Option A: Disable RLS (Recommended for now)**
```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetups DISABLE ROW LEVEL SECURITY;
```

Then handle authorization in your API endpoints using JWT token validation.

**Option B: Skip RLS policies**
- Don't run `11_rls_policies.sql`
- Use `SUPABASE_SERVICE_ROLE_KEY` in your API (bypasses RLS)
- Handle authorization in application code

**Recommendation**: Use Option B. Your API will use the service role key which bypasses RLS, and you'll handle authorization in your endpoint handlers.

---

## Test Data (Optional)

To add test users for development:
```sql
-- Run 12_test_data.sql in SQL Editor
```

---

## Rollback

If you need to start over:
```sql
-- Run rollback.sql in SQL Editor
-- ⚠️ This deletes ALL data!
```

---

## Next Steps

After database setup:
1. ✅ Configure Firebase credentials (see `database/README.md`)
2. ✅ Set up environment variables in `api/` and `socket/`
3. ✅ Start implementing authentication endpoints (TODO section 3)

