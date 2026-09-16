-- ==============================================================================
-- TUWSHIUAH WORKSPACE - MIGRATION 002 : CORRECTION RLS FICHIERS, DOSSIERS & PROFILES
-- ==============================================================================

-- 1. RENDRE LES COLONNES PROJECT_ID OPTIONNELLES DANS FILES ET FOLDERS
-- Permet de créer des dossiers et téléverser des fichiers dans l'espace général de l'agence sans projet
ALTER TABLE public.files ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.folders ALTER COLUMN project_id DROP NOT NULL;

-- 2. SUPPRESSION DU PROJET FICTIF "ESPACE GÉNÉRAL" (Si présent en base)
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-000000000001' OR name ILIKE '%Espace Général%';

-- 3. FONCTION D'ADMINISTRATION ROBUSTE & UNIFIÉE
CREATE OR REPLACE FUNCTION public.is_admin(user_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_uid
      AND (
        lower(p.role) = 'admin'
        OR lower(p.email) LIKE '%direction%'
        OR lower(p.email) LIKE '%samira%'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = user_uid
      AND (
        lower(u.email) LIKE '%direction%'
        OR lower(u.email) LIKE '%samira%'
        OR (u.raw_user_meta_data->>'role') = 'admin'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;

-- 4. MISE À JOUR DES PROFILS DIRECTION & SAMIRA EN TANT QU'ADMINISTRATEUR
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) LIKE '%direction%' OR lower(email) LIKE '%samira%';

-- 5. FONCTION DE VÉRIFICATION D'APPARTENANCE PROJET
CREATE OR REPLACE FUNCTION public.is_project_member(
  p_id UUID,
  user_uid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    p_id IS NULL
    OR p_id = '00000000-0000-0000-0000-000000000001'
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = p_id
        AND (
          p.created_by = user_uid
          OR EXISTS (
            SELECT 1
            FROM public.project_members pm
            WHERE pm.project_id = p_id
              AND pm.user_id = user_uid
          )
        )
    )
  );
$$;

-- 6. POLITIQUES RLS SUR LA TABLE FILES (TÉLÉVERSEMENT & CONSULTATION)
DROP POLICY IF EXISTS "files_select" ON public.files;
CREATE POLICY "files_select"
ON public.files
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "files_insert" ON public.files;
CREATE POLICY "files_insert"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "files_update" ON public.files;
CREATE POLICY "files_update"
ON public.files
FOR UPDATE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "files_delete" ON public.files;
CREATE POLICY "files_delete"
ON public.files
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_admin()
);

-- 7. POLITIQUES RLS SUR LA TABLE FOLDERS
DROP POLICY IF EXISTS "folders_member_select" ON public.folders;
DROP POLICY IF EXISTS "folders_select" ON public.folders;
CREATE POLICY "folders_select"
ON public.folders
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "folders_member_insert" ON public.folders;
DROP POLICY IF EXISTS "folders_insert" ON public.folders;
CREATE POLICY "folders_insert"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "folders_member_update" ON public.folders;
DROP POLICY IF EXISTS "folders_update" ON public.folders;
CREATE POLICY "folders_update"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "folders_member_delete" ON public.folders;
DROP POLICY IF EXISTS "folders_delete" ON public.folders;
CREATE POLICY "folders_delete"
ON public.folders
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin()
);

-- 8. POLITIQUES RLS SUR STORAGE (bucket project-files)
DROP POLICY IF EXISTS "project_files_select_members" ON storage.objects;
DROP POLICY IF EXISTS "project_files_select" ON storage.objects;
CREATE POLICY "project_files_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_insert_members" ON storage.objects;
DROP POLICY IF EXISTS "project_files_insert" ON storage.objects;
CREATE POLICY "project_files_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_update" ON storage.objects;
CREATE POLICY "project_files_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_delete" ON storage.objects;
CREATE POLICY "project_files_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'project-files');

-- 9. POLITIQUES RLS SUR PROFILES (MODIFICATION ET SUPPRESSION)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON public.profiles;
CREATE POLICY "profiles_update_all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = id
  OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_delete_own_admin" ON public.profiles;
CREATE POLICY "profiles_delete_own_admin"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
);

-- 10. FONCTION SÉCURISÉE DE SUPPRESSION COMPLÈTE DE COMPTE
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
BEGIN
  IF auth.uid() = target_user_id OR public.is_admin() THEN
    -- Détacher les éventuels fichiers sans violer storage.protect_delete()
    BEGIN
      UPDATE storage.objects SET owner = NULL WHERE owner = target_user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    DELETE FROM public.project_members WHERE user_id = target_user_id;
    DELETE FROM public.submission_comments WHERE user_id = target_user_id;
    DELETE FROM public.notifications WHERE user_id = target_user_id;
    DELETE FROM public.activities WHERE actor_id = target_user_id;
    DELETE FROM public.messages WHERE sender_id = target_user_id;

    UPDATE public.projects SET created_by = NULL WHERE created_by = target_user_id;
    UPDATE public.folders SET created_by = NULL WHERE created_by = target_user_id;
    UPDATE public.files SET uploaded_by = NULL WHERE uploaded_by = target_user_id;
    UPDATE public.submissions SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
    UPDATE public.messages SET deleted_by = NULL WHERE deleted_by = target_user_id;

    DELETE FROM public.profiles WHERE id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Non autorisé à supprimer ce compte utilisateur.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;

-- 11. FONCTION SÉCURISÉE DE MISE À JOUR DE PROFIL PAR L'ADMINISTRATEUR
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  target_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  res public.profiles%ROWTYPE;
BEGIN
  IF NOT (auth.uid() = target_user_id OR public.is_admin()) THEN
    RAISE EXCEPTION 'Non autorisé à modifier ce compte.';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    job_title = COALESCE(p_job_title, job_title),
    phone = COALESCE(p_phone, phone),
    role = COALESCE(p_role, role),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = target_user_id
  RETURNING * INTO res;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_strip_nulls(
    jsonb_build_object(
      'full_name', p_full_name,
      'job_title', p_job_title,
      'phone', p_phone,
      'role', p_role,
      'avatar_url', p_avatar_url
    )
  )
  WHERE id = target_user_id;

  RETURN to_jsonb(res);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
