/*
  # Bill Attachments

  ## Summary
  Creates the `bill_attachments` table to store metadata for files uploaded to
  Supabase Storage, and creates the storage bucket `bill-attachments` with public
  read access (files are served by signed URLs in the app).

  ## New Tables
  - `bill_attachments`
    - `id` (uuid, primary key)
    - `bill_id` (uuid, FK → bills.id ON DELETE CASCADE) — owning bill
    - `file_name` (text) — original file name shown to the user
    - `storage_path` (text) — path inside the `bill-attachments` bucket
    - `mime_type` (text) — e.g. application/pdf, image/jpeg, image/png
    - `size_bytes` (bigint) — file size in bytes
    - `created_at` (timestamptz)

  ## Storage
  - Bucket `bill-attachments` created (public: false — files served via signed URLs)
  - Storage policies allow public insert/select/delete so the anon key can manage files

  ## Security
  - RLS enabled on `bill_attachments`
  - Public select/insert/delete policies (matching the rest of the system)
*/

-- Table
CREATE TABLE IF NOT EXISTS bill_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  storage_path text NOT NULL,
  mime_type    text NOT NULL DEFAULT '',
  size_bytes   bigint NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE bill_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can select bill_attachments"
  ON bill_attachments FOR SELECT TO public USING (true);

CREATE POLICY "Public can insert bill_attachments"
  ON bill_attachments FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can delete bill_attachments"
  ON bill_attachments FOR DELETE TO public USING (true);

CREATE INDEX IF NOT EXISTS idx_bill_attachments_bill_id ON bill_attachments(bill_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bill-attachments',
  'bill-attachments',
  false,
  10485760,  -- 10 MB per file
  ARRAY['application/pdf','image/jpeg','image/png','image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments public insert'
  ) THEN
    CREATE POLICY "bill-attachments public insert"
      ON storage.objects FOR INSERT TO public
      WITH CHECK (bucket_id = 'bill-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments public select'
  ) THEN
    CREATE POLICY "bill-attachments public select"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'bill-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments public delete'
  ) THEN
    CREATE POLICY "bill-attachments public delete"
      ON storage.objects FOR DELETE TO public
      USING (bucket_id = 'bill-attachments');
  END IF;
END $$;
