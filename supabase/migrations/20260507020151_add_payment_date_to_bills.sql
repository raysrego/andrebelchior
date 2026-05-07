/*
  # Add payment_date to bills

  ## Summary
  Adds a `payment_date` column to the `bills` table to record the actual date a bill was paid.

  ## Modified Tables
  - `bills`
    - Added `payment_date` (date, nullable) — the date payment was made, set when status changes to 'pago'

  ## Notes
  - Nullable so existing records are unaffected
  - Only relevant when status = 'pago'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE bills ADD COLUMN payment_date date;
  END IF;
END $$;
