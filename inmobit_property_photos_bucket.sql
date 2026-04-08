-- Run this in Supabase SQL Editor to create the property-photos storage bucket

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload property photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-photos');

-- Allow public read access
CREATE POLICY "Public can view property photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'property-photos');

-- Allow owners to delete their photos
CREATE POLICY "Users can delete own property photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
