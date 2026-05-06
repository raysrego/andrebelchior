/*
  # Add external_payment fields to bills table

  ## Summary
  Adds support for "pagamento externo" (external payment) on bills. When a bill
  is marked as external, it will NOT affect the initial/entry/final balance
  calculations, but will still be counted in "Despesas Pagas" and
  "Projeção de Despesas".

  ## Changes

  ### Modified Tables
  - `bills`
    - `external_payment` (boolean, DEFAULT false) — marks whether this bill is
      paid outside the tracked accounts (e.g., via another bank, cash, etc.)
    - `external_payment_description` (text, DEFAULT '') — free-text description
      of how/where the payment was made externally

  ## Notes
  - Both columns are nullable-safe with sensible defaults so existing rows are
    unaffected (they default to external_payment = false).
  - No data is dropped or modified.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'external_payment'
  ) THEN
    ALTER TABLE bills ADD COLUMN external_payment boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'external_payment_description'
  ) THEN
    ALTER TABLE bills ADD COLUMN external_payment_description text NOT NULL DEFAULT '';
  END IF;
END $$;
