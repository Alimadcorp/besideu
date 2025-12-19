-- 1) Add is_active column if not exists
ALTER TABLE meetups
ADD COLUMN IF NOT EXISTS is_active boolean;

-- 2) Populate existing rows
UPDATE meetups
SET is_active = (status IN ('pending','accepted') AND expires_at > NOW());

-- 3) Create trigger function to maintain is_active
CREATE OR REPLACE FUNCTION meetups_set_is_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Compute is_active based only on NEW row values and current time.
  -- This uses NOW(); the function itself is VOLATILE by necessity because it reads current time,
  -- but that's OK because it's not used inside an index predicate. The index will reference the stored column.
  NEW.is_active := (NEW.status IN ('pending','accepted') AND NEW.expires_at > NOW());
  RETURN NEW;
END;
$$;

-- 4) Create trigger calling the function before INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_meetups_set_is_active ON meetups;

CREATE TRIGGER trg_meetups_set_is_active
BEFORE INSERT OR UPDATE OF status, expires_at ON meetups
FOR EACH ROW
EXECUTE FUNCTION meetups_set_is_active();

-- 5) Create a partial index on the stored boolean to keep the index small
CREATE INDEX IF NOT EXISTS idx_meetups_active
ON meetups (status, expires_at)
WHERE is_active;

-- 6) (Optional) Create a plain index if you want a non-partial fallback
-- CREATE INDEX IF NOT EXISTS idx_meetups_status_expires_at
-- ON meetups (status, expires_at);