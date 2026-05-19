/*
  # Fix storage policies for bill-attachments bucket

  ## Problem
  Storage policies were created with TO public, but Supabase Storage requires
  TO anon (and optionally TO authenticated) for the JS client to work correctly.
  The public PostgreSQL role is not the same as Supabase's anon role.

  ## Changes
  - Drop existing storage policies that use TO public
  - Recreate them using TO anon so the Supabase JS client (anon key) can upload,
    read, update, and delete objects in the bill-attachments bucket
*/

DO $$
BEGIN
  -- Drop old public-role policies
  DROP POLICY IF EXISTS "bill-attachments public insert" ON storage.objects;
  DROP POLICY IF EXISTS "bill-attachments public select" ON storage.objects;
  DROP POLICY IF EXISTS "bill-attachments public delete" ON storage.objects;
  DROP POLICY IF EXISTS "bill-attachments public update" ON storage.objects;
END $$;

CREATE POLICY "bill-attachments anon insert"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'bill-attachments');

CREATE POLICY "bill-attachments anon select"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'bill-attachments');

CREATE POLICY "bill-attachments anon update"
  ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'bill-attachments')
  WITH CHECK (bucket_id = 'bill-attachments');

CREATE POLICY "bill-attachments anon delete"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'bill-attachments');
