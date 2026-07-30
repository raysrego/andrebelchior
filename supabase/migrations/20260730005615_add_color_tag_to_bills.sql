/*
# Add color_tag to bills table

## Summary
Adds a `color_tag` column to the `bills` table to allow users to visually
categorize each bill by color, matching a physical color-coded paper system.

## Changes
- `bills` table: new nullable `color_tag` column
  - Allowed values: 'orange', 'blue', 'yellow', or NULL (no color)
  - orange = Pay at the lottery 8 days before due
  - blue = Send to André and follow up until paid
  - yellow = Pay from Nubank

## Notes
- Column is nullable — existing rows get NULL (no color) by default.
- A CHECK constraint enforces only the 3 valid color values or NULL.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'color_tag'
  ) THEN
    ALTER TABLE public.bills
      ADD COLUMN color_tag text
        CHECK (color_tag IN ('orange', 'blue', 'yellow'));
  END IF;
END $$;
