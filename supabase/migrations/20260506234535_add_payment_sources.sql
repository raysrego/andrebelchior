/*
  # Add Payment Sources (Fontes Pagadoras)

  ## Summary
  Creates a new `payment_sources` table to register external payment sources (fontes pagadoras).
  Updates the `bills` table to reference a payment source instead of free-text description
  when external_payment is true.

  ## New Tables
  - `payment_sources`
    - `id` (uuid, primary key)
    - `name` (text, not null) — name of the payment source
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Modified Tables
  - `bills`
    - Added `payment_source_id` (uuid, nullable FK to payment_sources.id)
      Replaces the free-text `external_payment_description` for structured lookups.
      The old `external_payment_description` column is kept for backwards compatibility.

  ## Security
  - RLS enabled on `payment_sources`
  - Public select/insert/update/delete policies (matching existing tables)
*/

CREATE TABLE IF NOT EXISTS payment_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can select payment_sources"
  ON payment_sources FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert payment_sources"
  ON payment_sources FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update payment_sources"
  ON payment_sources FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete payment_sources"
  ON payment_sources FOR DELETE
  TO public
  USING (true);

-- Add payment_source_id FK to bills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'payment_source_id'
  ) THEN
    ALTER TABLE bills ADD COLUMN payment_source_id uuid REFERENCES payment_sources(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_sources_name ON payment_sources(name);
CREATE INDEX IF NOT EXISTS idx_bills_payment_source_id ON bills(payment_source_id);
