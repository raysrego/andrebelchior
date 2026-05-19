/*
  # Add authenticated role policies for bill-attachments storage and table

  ## Root Cause
  After the login system was introduced, users operate as the `authenticated` role
  in Supabase (not `anon`). All existing storage policies only targeted the `anon`
  role, so logged-in users had no permission to upload, read, or delete files —
  causing the "Bucket not found" 404 error on all storage operations.

  ## Changes
  1. Storage (storage.objects):
     - Add INSERT, SELECT, UPDATE, DELETE policies for `authenticated` role
       on the bill-attachments bucket
  2. bill_attachments table:
     - Add SELECT, INSERT, DELETE policies for `authenticated` role
       (existing policies only covered `public` role)
*/

-- Storage policies for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments authenticated insert'
  ) THEN
    CREATE POLICY "bill-attachments authenticated insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'bill-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments authenticated select'
  ) THEN
    CREATE POLICY "bill-attachments authenticated select"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'bill-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments authenticated update'
  ) THEN
    CREATE POLICY "bill-attachments authenticated update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'bill-attachments')
      WITH CHECK (bucket_id = 'bill-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments authenticated delete'
  ) THEN
    CREATE POLICY "bill-attachments authenticated delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'bill-attachments');
  END IF;
END $$;

-- bill_attachments table policies for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bill_attachments'
      AND policyname = 'Authenticated can select bill_attachments'
  ) THEN
    CREATE POLICY "Authenticated can select bill_attachments"
      ON bill_attachments FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bill_attachments'
      AND policyname = 'Authenticated can insert bill_attachments'
  ) THEN
    CREATE POLICY "Authenticated can insert bill_attachments"
      ON bill_attachments FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bill_attachments'
      AND policyname = 'Authenticated can delete bill_attachments'
  ) THEN
    CREATE POLICY "Authenticated can delete bill_attachments"
      ON bill_attachments FOR DELETE TO authenticated
      USING (true);
  END IF;
END $$;
