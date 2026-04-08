-- ============================================
-- InmoBit: Trigger para crear perfil de usuario
-- y bucket de avatars
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Función trigger: al crear usuario en auth.users,
--    inserta registro en public.users con los metadatos del signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone_mobile, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sin nombre'),
    NEW.raw_user_meta_data->>'phone_mobile',
    COALESCE(NEW.raw_user_meta_data->>'role', 'CLIENT')
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Bucket de avatars (público para lectura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Políticas de storage para avatars
-- Cualquier usuario autenticado puede subir su propio avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Cualquier usuario autenticado puede actualizar su propio avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública de avatars
CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
