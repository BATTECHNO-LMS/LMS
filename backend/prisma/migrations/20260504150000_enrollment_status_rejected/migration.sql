-- Student enrollment rejection (admin workflow)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enrollment_status' AND e.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE "enrollment_status" ADD VALUE 'rejected';
  END IF;
END $$;
