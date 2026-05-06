/*
  # Financial System - Accounts Payable

  1. New Tables
    - `cost_centers` - Cost center registry
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `created_at` (timestamp)

    - `bills` - Accounts payable entries
      - `id` (uuid, primary key)
      - `status` (text: 'aberto', 'pago', 'vencido')
      - `due_date` (date)
      - `item` (text)
      - `amount` (numeric)
      - `cost_center_id` (uuid, FK to cost_centers)
      - `classification` (text: 'fixo', 'fixo_variavel', 'extra')
      - `bank_info` (text)
      - `reference_month` (text, format YYYY-MM)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `income_entries` - Income/revenue entries
      - `id` (uuid, primary key)
      - `description` (text)
      - `amount` (numeric)
      - `date` (date)
      - `origin` (text)
      - `reference_month` (text, format YYYY-MM)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `monthly_balances` - Monthly balance tracking
      - `id` (uuid, primary key)
      - `reference_month` (text, format YYYY-MM, unique)
      - `initial_balance` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (single-user system, no auth required)

  3. Notes
    - reference_month format: 'YYYY-MM' (e.g., '2026-05')
    - Status 'vencido' is managed via application logic checking due_date vs current date
*/

-- Cost Centers table
CREATE TABLE IF NOT EXISTS cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to cost_centers"
  ON cost_centers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert cost_centers"
  ON cost_centers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update cost_centers"
  ON cost_centers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete cost_centers"
  ON cost_centers FOR DELETE
  TO anon, authenticated
  USING (true);

-- Bills (Contas a Pagar) table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'pago', 'vencido')),
  due_date date NOT NULL,
  item text NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  cost_center_id uuid REFERENCES cost_centers(id) ON DELETE SET NULL,
  classification text NOT NULL DEFAULT 'fixo' CHECK (classification IN ('fixo', 'fixo_variavel', 'extra')),
  bank_info text DEFAULT '',
  reference_month text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full select on bills"
  ON bills FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on bills"
  ON bills FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on bills"
  ON bills FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on bills"
  ON bills FOR DELETE
  TO anon, authenticated
  USING (true);

-- Income Entries table
CREATE TABLE IF NOT EXISTS income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  date date NOT NULL,
  origin text DEFAULT '',
  reference_month text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full select on income_entries"
  ON income_entries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on income_entries"
  ON income_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on income_entries"
  ON income_entries FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on income_entries"
  ON income_entries FOR DELETE
  TO anon, authenticated
  USING (true);

-- Monthly Balances table
CREATE TABLE IF NOT EXISTS monthly_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month text UNIQUE NOT NULL,
  initial_balance numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE monthly_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full select on monthly_balances"
  ON monthly_balances FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert on monthly_balances"
  ON monthly_balances FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on monthly_balances"
  ON monthly_balances FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on monthly_balances"
  ON monthly_balances FOR DELETE
  TO anon, authenticated
  USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS bills_reference_month_idx ON bills(reference_month);
CREATE INDEX IF NOT EXISTS bills_due_date_idx ON bills(due_date);
CREATE INDEX IF NOT EXISTS bills_status_idx ON bills(status);
CREATE INDEX IF NOT EXISTS income_entries_reference_month_idx ON income_entries(reference_month);
CREATE INDEX IF NOT EXISTS monthly_balances_reference_month_idx ON monthly_balances(reference_month);
