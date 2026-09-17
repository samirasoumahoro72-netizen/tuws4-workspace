-- ==============================================================================
-- 003_ADD_FILE_SHARING_AND_PRIVATE_SPACES.SQL
-- Migration garantissant l'espace de fichiers privé par collaborateur et le partage explicite
-- ==============================================================================

-- 1. Ajout de la colonne shared_with à la table files
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}';

-- 2. Index GIN pour les recherches ultra-performantes sur les partages
CREATE INDEX IF NOT EXISTS idx_files_shared_with ON public.files USING GIN (shared_with);

-- 3. Mise à jour de la politique de sélection RLS :
-- Un fichier est STRICTEMENT visible uniquement par :
--   - Son propriétaire (uploaded_by = auth.uid())
--   - OU un collaborateur à qui le propriétaire a explicitement partagé le fichier (auth.uid() = ANY(shared_with))
--   - OU les administrateurs de la direction
DROP POLICY IF EXISTS "files_select" ON public.files;
CREATE POLICY "files_select"
ON public.files
FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR auth.uid() = ANY(shared_with)
  OR public.is_admin()
);

-- 4. Seul le propriétaire ou un administrateur peut modifier les métadonnées ou le partage d'un fichier
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

-- 5. Seul le propriétaire ou un administrateur peut supprimer un fichier
DROP POLICY IF EXISTS "files_delete" ON public.files;
CREATE POLICY "files_delete"
ON public.files
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_admin()
);

-- 6. Dossiers personnels : Seul le créateur ou un administrateur peut voir ses dossiers personnels
DROP POLICY IF EXISTS "folders_select" ON public.folders;
CREATE POLICY "folders_select"
ON public.folders
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR project_id IS NOT NULL
  OR public.is_admin()
);
