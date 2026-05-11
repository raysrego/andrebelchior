/*
  # Rosimar - Controle de Pagamentos

  ## Descrição
  Módulo completamente separado dos outros dados do sistema financeiro,
  dedicado ao controle de pagamentos da Rosimar.

  ## Novas Tabelas
  - `rosimar_payments`: Registros de contas a pagar/controle de pagamentos
    - `id` (uuid, pk)
    - `user_id` (uuid, FK auth.users) - dono do registro
    - `due_date` (date) - data de vencimento
    - `item` (text) - nome do item/conta
    - `description` (text) - descrição detalhada
    - `bank_info` (text) - dado bancário (banco, agência, conta, pix)
    - `observation` (text) - observação livre
    - `amount` (numeric) - valor
    - `status` (text) - 'pendente' | 'pago'
    - `paid_at` (date) - data em que foi pago
    - `reference_month` (text) - mês de referência YYYY-MM
    - `created_at`, `updated_at`

  - `rosimar_attachments`: Arquivos anexados a cada pagamento
    - `id` (uuid, pk)
    - `payment_id` (uuid, FK rosimar_payments)
    - `file_name` (text)
    - `storage_path` (text) - caminho no Supabase Storage
    - `mime_type` (text)
    - `size_bytes` (bigint)
    - `created_at`

  ## Segurança
  - RLS habilitado em ambas as tabelas
  - Usuário só acessa seus próprios registros
*/

-- Tabela principal de pagamentos
CREATE TABLE IF NOT EXISTS rosimar_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  item text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  bank_info text NOT NULL DEFAULT '',
  observation text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  paid_at date,
  reference_month text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rosimar_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rosimar: users can select own payments"
  ON rosimar_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Rosimar: users can insert own payments"
  ON rosimar_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Rosimar: users can update own payments"
  ON rosimar_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Rosimar: users can delete own payments"
  ON rosimar_payments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_rosimar_payments_user_id ON rosimar_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_rosimar_payments_reference_month ON rosimar_payments(reference_month);
CREATE INDEX IF NOT EXISTS idx_rosimar_payments_due_date ON rosimar_payments(due_date);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS rosimar_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES rosimar_payments(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rosimar_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rosimar: users can select own attachments"
  ON rosimar_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rosimar_payments
      WHERE rosimar_payments.id = rosimar_attachments.payment_id
        AND rosimar_payments.user_id = auth.uid()
    )
  );

CREATE POLICY "Rosimar: users can insert own attachments"
  ON rosimar_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rosimar_payments
      WHERE rosimar_payments.id = rosimar_attachments.payment_id
        AND rosimar_payments.user_id = auth.uid()
    )
  );

CREATE POLICY "Rosimar: users can delete own attachments"
  ON rosimar_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rosimar_payments
      WHERE rosimar_payments.id = rosimar_attachments.payment_id
        AND rosimar_payments.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_rosimar_attachments_payment_id ON rosimar_attachments(payment_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_rosimar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rosimar_payments_updated_at
  BEFORE UPDATE ON rosimar_payments
  FOR EACH ROW EXECUTE FUNCTION update_rosimar_updated_at();
