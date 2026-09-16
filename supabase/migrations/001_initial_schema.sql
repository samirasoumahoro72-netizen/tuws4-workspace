-- ==============================================================================
-- TUWSHIUAH WORKSPACE - SCHEMA SUPABASE PROPRE
-- Version corrigée pour éviter les erreurs de colonnes/RLS.
--
-- IMPORTANT :
-- Cette version RECRÉE les tables métier de l'application.
-- Elle ne touche PAS à auth.users.
-- À exécuter uniquement si les données actuelles de l'application peuvent être
-- supprimées. Les fichiers Storage des buckets concernés doivent aussi être
-- considérés comme réinitialisables.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 0. NETTOYAGE DES ANCIENNES TABLES MÉTIER
-- ==============================================================================

DROP TABLE IF EXISTS public.submission_comments CASCADE;
DROP TABLE IF EXISTS public.submission_files CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Nettoyage des anciennes fonctions pour éviter les ambiguïtés de signature (ERROR: 42725)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_project_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_project_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_user_exists(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- ==============================================================================
-- 1. PROFILES
-- ==============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'employee'
    CHECK (role IN ('admin', 'employee')),
  avatar_url TEXT,
  job_title TEXT,
  phone TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 2. FONCTIONS UTILITAIRES
-- SECURITY DEFINER + search_path fixe pour les contrôles RLS.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(user_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_uid
      AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_user_exists(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(u.email) = lower(user_email)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. CRÉATION AUTOMATIQUE DU PROFIL APRÈS INSCRIPTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    avatar_url,
    job_title,
    phone,
    is_online
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
      ELSE 'employee'
    END,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || md5(COALESCE(NEW.email, NEW.id::text))
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'job_title',
      CASE WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'Direction Générale' ELSE 'Collaborateur' END
    ),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    job_title = COALESCE(EXCLUDED.job_title, public.profiles.job_title),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Assure que l'inscription dans auth.users n'est jamais bloquée
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. PROJECTS
-- ==============================================================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN (
      'todo',
      'in_progress',
      'review',
      'completed',
      'delayed'
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN (
      'low',
      'medium',
      'high',
      'urgent'
    )),
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  progress INTEGER NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 5. PROJECT MEMBERS
-- ==============================================================================

CREATE TABLE public.project_members (
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, user_id)
);

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
    FROM public.project_members pm
    WHERE pm.project_id = p_id
      AND pm.user_id = user_uid
  );
$$;

-- ==============================================================================
-- 6. FOLDERS
-- ==============================================================================

CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 7. FILES
-- ==============================================================================

CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 8. SUBMISSIONS
-- ==============================================================================

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING',
      'APPROVED',
      'CHANGES_REQUESTED'
    )),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_submissions_updated_at
BEFORE UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 9. SUBMISSION FILES
-- ==============================================================================

CREATE TABLE public.submission_files (
  submission_id UUID NOT NULL
    REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_id UUID NOT NULL
    REFERENCES public.files(id) ON DELETE CASCADE,
  PRIMARY KEY (submission_id, file_id)
);

-- ==============================================================================
-- 10. SUBMISSION COMMENTS
-- ==============================================================================

CREATE TABLE public.submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL
    REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 11. NOTIFICATIONS
-- ==============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SYSTEM',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 12. ACTIVITIES
-- ==============================================================================

CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 13. MESSAGES
-- ==============================================================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Message dans un projet OU conversation directe
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  direct_channel_id TEXT,

  sender_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  reactions JSONB NOT NULL DEFAULT '[]'::jsonb,

  read_at TIMESTAMPTZ,
  read_by JSONB NOT NULL DEFAULT '[]'::jsonb,

  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_for JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_message_target CHECK (
    (project_id IS NOT NULL AND direct_channel_id IS NULL)
    OR
    (project_id IS NULL AND direct_channel_id IS NOT NULL)
  )
);

-- ==============================================================================
-- 14. STORAGE BUCKETS
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ==============================================================================
-- 15. INDEXES
-- ==============================================================================

CREATE INDEX idx_project_members_user_id
  ON public.project_members(user_id);

CREATE INDEX idx_project_members_project_id
  ON public.project_members(project_id);

CREATE INDEX idx_folders_project_id
  ON public.folders(project_id);

CREATE INDEX idx_folders_parent_id
  ON public.folders(parent_id);

CREATE INDEX idx_files_project_id
  ON public.files(project_id);

CREATE INDEX idx_files_folder_id
  ON public.files(folder_id);

CREATE INDEX idx_files_uploaded_by
  ON public.files(uploaded_by);

CREATE INDEX idx_submissions_project_id
  ON public.submissions(project_id);

CREATE INDEX idx_submissions_submitted_by
  ON public.submissions(submitted_by);

CREATE INDEX idx_submissions_status
  ON public.submissions(status);

CREATE INDEX idx_submission_files_submission_id
  ON public.submission_files(submission_id);

CREATE INDEX idx_submission_comments_submission_id
  ON public.submission_comments(submission_id);

CREATE INDEX idx_notifications_user_id
  ON public.notifications(user_id);

CREATE INDEX idx_notifications_is_read
  ON public.notifications(is_read);

CREATE INDEX idx_activities_project_id
  ON public.activities(project_id);

CREATE INDEX idx_activities_actor_id
  ON public.activities(actor_id);

CREATE INDEX idx_activities_created_at
  ON public.activities(created_at DESC);

CREATE INDEX idx_messages_project_id
  ON public.messages(project_id);

CREATE INDEX idx_messages_direct_channel_id
  ON public.messages(direct_channel_id);

CREATE INDEX idx_messages_sender_id
  ON public.messages(sender_id);

CREATE INDEX idx_messages_created_at
  ON public.messages(created_at ASC);

-- ==============================================================================
-- 16. RLS
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 17. PROFILES POLICIES
-- ==============================================================================

CREATE POLICY "profiles_select_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (
  public.is_admin()
  OR (
    auth.uid() = id
    AND role = 'employee'
  )
);

CREATE POLICY "profiles_admin_all"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- 18. PROJECTS POLICIES
-- ==============================================================================

CREATE POLICY "projects_select"
ON public.projects
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_project_member(id)
  OR created_by = auth.uid()
);

CREATE POLICY "projects_admin_all"
ON public.projects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- 19. PROJECT MEMBERS POLICIES
-- ==============================================================================

CREATE POLICY "project_members_select"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_project_member(project_id)
);

CREATE POLICY "project_members_admin_all"
ON public.project_members
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- 20. FOLDERS POLICIES
-- ==============================================================================

CREATE POLICY "folders_select"
ON public.folders
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_project_member(project_id)
);

CREATE POLICY "folders_member_insert"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_admin() OR public.is_project_member(project_id))
  AND created_by = auth.uid()
);

CREATE POLICY "folders_member_update"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR public.is_project_member(project_id)
)
WITH CHECK (
  public.is_admin()
  OR public.is_project_member(project_id)
);

CREATE POLICY "folders_member_delete"
ON public.folders
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR public.is_project_member(project_id)
);

-- ==============================================================================
-- 21. FILES POLICIES
-- ==============================================================================

CREATE POLICY "files_select"
ON public.files
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_project_member(project_id)
);

CREATE POLICY "files_insert"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_admin() OR public.is_project_member(project_id))
  AND uploaded_by = auth.uid()
);

CREATE POLICY "files_update"
ON public.files
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR uploaded_by = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR uploaded_by = auth.uid()
);

CREATE POLICY "files_delete"
ON public.files
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR uploaded_by = auth.uid()
);

-- ==============================================================================
-- 22. SUBMISSIONS POLICIES
-- ==============================================================================

CREATE POLICY "submissions_select"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR submitted_by = auth.uid()
  OR public.is_project_member(project_id)
);

CREATE POLICY "submissions_insert"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND (public.is_admin() OR public.is_project_member(project_id))
  AND status = 'PENDING'
);

CREATE POLICY "submissions_update"
ON public.submissions
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR (
    submitted_by = auth.uid()
    AND status = 'CHANGES_REQUESTED'
  )
)
WITH CHECK (
  public.is_admin()
  OR (
    submitted_by = auth.uid()
    AND status = 'PENDING'
  )
);

CREATE POLICY "submissions_delete_admin"
ON public.submissions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ==============================================================================
-- 23. SUBMISSION FILES POLICIES
-- ==============================================================================

CREATE POLICY "submission_files_select"
ON public.submission_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.id = submission_id
      AND (
        public.is_admin()
        OR s.submitted_by = auth.uid()
        OR public.is_project_member(s.project_id)
      )
  )
);

CREATE POLICY "submission_files_insert"
ON public.submission_files
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.id = submission_id
      AND (
        public.is_admin()
        OR s.submitted_by = auth.uid()
      )
  )
);

CREATE POLICY "submission_files_delete"
ON public.submission_files
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.id = submission_id
      AND (
        public.is_admin()
        OR s.submitted_by = auth.uid()
      )
  )
);

-- ==============================================================================
-- 24. SUBMISSION COMMENTS
-- ==============================================================================

CREATE POLICY "submission_comments_select"
ON public.submission_comments
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.id = submission_id
      AND public.is_project_member(s.project_id)
  )
);

CREATE POLICY "submission_comments_insert"
ON public.submission_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.id = submission_id
      AND (
        public.is_admin()
        OR s.submitted_by = auth.uid()
        OR public.is_project_member(s.project_id)
      )
  )
);

CREATE POLICY "submission_comments_update_own"
ON public.submission_comments
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR user_id = auth.uid()
);

CREATE POLICY "submission_comments_delete_own"
ON public.submission_comments
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR user_id = auth.uid()
);

-- ==============================================================================
-- 25. NOTIFICATIONS
-- ==============================================================================

CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- L'application crée des notifications pour d'autres collaborateurs.
-- Cette politique permet l'insertion depuis le client authentifié.
CREATE POLICY "notifications_insert_authenticated"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
);

-- ==============================================================================
-- 26. ACTIVITIES
-- ==============================================================================

CREATE POLICY "activities_select"
ON public.activities
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR actor_id = auth.uid()
  OR (
    project_id IS NOT NULL
    AND public.is_project_member(project_id)
  )
);

CREATE POLICY "activities_insert"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  OR public.is_admin()
);

-- ==============================================================================
-- 27. MESSAGES
-- ==============================================================================

CREATE POLICY "messages_select"
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    project_id IS NOT NULL
    AND public.is_project_member(project_id)
  )
  OR (
    direct_channel_id IS NOT NULL
    AND direct_channel_id LIKE '%' || auth.uid()::text || '%'
  )
);

CREATE POLICY "messages_insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_admin()
    OR (
      project_id IS NOT NULL
      AND public.is_project_member(project_id)
    )
    OR (
      direct_channel_id IS NOT NULL
      AND direct_channel_id LIKE '%' || auth.uid()::text || '%'
    )
  )
);

CREATE POLICY "messages_update_own"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  sender_id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "messages_delete_own"
ON public.messages
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_admin()
);

-- ==============================================================================
-- 28. STORAGE - PROJET
-- ==============================================================================

-- Les fichiers de projet sont stockés avec le project_id comme premier dossier.
-- Exemple :
-- project-files/<project_id>/<folder_id>/<file_id>-nom.pdf

CREATE POLICY "project_files_select_members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files'
  AND (
    public.is_admin()
    OR public.is_project_member(
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  )
);

CREATE POLICY "project_files_insert_members"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND (
    public.is_admin()
    OR public.is_project_member(
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  )
);

CREATE POLICY "project_files_delete_owner_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND (
    public.is_admin()
    OR owner_id = auth.uid()::text
  )
);

-- ==============================================================================
-- 29. STORAGE - PIÈCES JOINTES DES MESSAGES
-- ==============================================================================

-- Les pièces jointes de chat restent privées aux utilisateurs authentifiés.
-- La protection métier des messages reste assurée par public.messages.
CREATE POLICY "chat_attachments_select_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
);

CREATE POLICY "chat_attachments_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "chat_attachments_delete_owner_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    public.is_admin()
    OR owner_id = auth.uid()::text
  )
);

-- ==============================================================================
-- 30. REALTIME
-- ==============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- ==============================================================================
-- FIN
-- ==============================================================================

SELECT 'TUWSHIUAH Workspace : schéma créé avec succès.' AS result;

