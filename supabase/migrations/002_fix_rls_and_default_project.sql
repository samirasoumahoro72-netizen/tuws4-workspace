-- ==============================================================================
-- TUWSHIUAH WORKSPACE - MIGRATION 002 : CORRECTION RLS & ESPACE GÉNÉRAL & SUPPRESSION DE COMPTE
-- ==============================================================================

-- 1. CRÉATION DU PROJET PAR DÉFAUT "ESPACE GÉNÉRAL"
INSERT INTO public.projects (
  id,
  name,
  description,
  status,
  priority,
  progress,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Espace Général TUWSHIUAH',
  'Espace centralisé pour les ressources, fichiers et documents partagés de l''agence',
  'in_progress',
  'medium',
  100,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ==============================================================================
-- 2. FONCTION DE VÉRIFICATION D'APPARTENANCE PROJET (AMÉLIORÉE)
-- ==============================================================================

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
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_id
      AND (
        -- L'espace général est accessible à tous les membres connectés
        p.id = '00000000-0000-0000-0000-000000000001'
        -- Le créateur est toujours membre de son projet
        OR p.created_by = user_uid
        -- Membre assigné
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p_id
            AND pm.user_id = user_uid
        )
      )
  );
$$;

-- ==============================================================================
-- 3. POLITIQUES RLS SUR LA TABLE PROJECTS
-- ==============================================================================

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select"
ON public.projects
FOR SELECT
TO authenticated
USING (
  id = '00000000-0000-0000-0000-000000000001'
  OR public.is_admin()
  OR public.is_project_member(id)
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "projects_insert_authenticated" ON public.projects;
CREATE POLICY "projects_insert_authenticated"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR public.is_admin()
  OR id = '00000000-0000-0000-0000-000000000001'
);

DROP POLICY IF EXISTS "projects_update_creator_admin" ON public.projects;
CREATE POLICY "projects_update_creator_admin"
ON public.projects
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

-- ==============================================================================
-- 4. POLITIQUES RLS SUR STORAGE (project-files)
-- ==============================================================================

DROP POLICY IF EXISTS "project_files_select_members" ON storage.objects;
CREATE POLICY "project_files_select_members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
    OR public.is_project_member(
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  )
);

DROP POLICY IF EXISTS "project_files_insert_members" ON storage.objects;
CREATE POLICY "project_files_insert_members"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
    OR public.is_project_member(
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  )
);

-- ==============================================================================
-- 5. FONCTION D'ADMINISTRATION ROBUSTE & UNIFIÉE
-- ==============================================================================

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

-- ==============================================================================
-- 6. POLITIQUES RLS SUR PROFILES (MODIFICATION ET SUPPRESSION)
-- ==============================================================================

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

-- ==============================================================================
-- 7. FONCTION SÉCURISÉE DE SUPPRESSION COMPLÈTE DE COMPTE (AUTH + PROFILES + STORAGE)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
BEGIN
  -- L'administrateur ou l'utilisateur lui-même peut supprimer le compte
  IF auth.uid() = target_user_id OR public.is_admin() THEN
    -- 1. Détacher les fichiers éventuels dans storage sans violer storage.protect_delete()
    BEGIN
      UPDATE storage.objects SET owner = NULL WHERE owner = target_user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- 2. Nettoyer les dépendances directes
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

    -- 3. Supprimer le profil public
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 4. Supprimer le compte auth (ce qui révoque tokens et sessions)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Non autorisé à supprimer ce compte utilisateur.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;

-- ==============================================================================
-- 8. FONCTION SÉCURISÉE DE MISE À JOUR DE PROFIL PAR L'ADMINISTRATEUR
-- ==============================================================================

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

  -- Synchroniser les métadonnées auth
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

-- ==============================================================================
-- 9. SUPPRESSION / MODIFICATION DIRECTE DE SECOURS DANS LE SQL EDITOR SUPABASE
-- Si vous souhaitez supprimer immédiatement le compte manuellement dans SQL Editor :
-- DELETE FROM auth.users WHERE email = 'adiatounoura@tuwshiuah.com';
-- ==============================================================================

