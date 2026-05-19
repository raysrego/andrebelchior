/*
  # Add UPDATE policy on storage.objects for bill-attachments bucket

  ## Problem
  createSignedUrl() internally requires an UPDATE policy on storage.objects.
  Without it, Supabase returns "Bucket not found" when trying to generate
  signed URLs for viewing/downloading attachments.

  ## Changes
  - Adds UPDATE policy on storage.objects for the bill-attachments bucket
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bill-attachments public update'
  ) THEN
    CREATE POLICY "bill-attachments public update"
      ON storage.objects FOR UPDATE TO public
      USING (bucket_id = 'bill-attachments')
      WITH CHECK (bucket_id = 'bill-attachments');
  END IF;
END $$;
