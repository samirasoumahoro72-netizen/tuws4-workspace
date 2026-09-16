export type UserRole = 'admin' | 'employee';

export type ProjectStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'DELAYED';

export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';

export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export type DbProjectStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'delayed';

export interface Profile {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  role: UserRole;
  gender?: 'male' | 'female';
  avatar_url?: string;
  job_title?: string;
  is_online?: boolean;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  title: string;
  name?: string;
  description: string;
  category: string;
  status: ProjectStatus;
  priority?: ProjectPriority;
  progress: number;
  deadline: string;
  start_date?: string;
  due_date?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  members?: Profile[];
  files_count?: number;
  submissions_count?: number;
}

export interface ProjectMember {
  id?: string;
  project_id: string;
  user_id: string;
  added_by?: string;
  role_in_project?: string;
  profile?: Profile;
}

export interface Folder {
  id: string;
  project_id?: string | null;
  name: string;
  parent_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  files_count?: number;
  total_size?: string;
}

export interface FileItem {
  id: string;
  project_id?: string | null;
  folder_id?: string | null;
  name: string;
  size_bytes: number;
  size_formatted: string;
  file_type: string;
  file_url: string;
  storage_path?: string;
  mime_type?: string;
  uploaded_by: string;
  uploader?: Profile;
  created_at: string;
  updated_at?: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  size_formatted: string;
  type: 'image' | 'document';
  mime_type: string;
  url: string;
  storage_path?: string;
}

export interface MessageReaction {
  emoji: string;
  user_id: string;
  user_name: string;
  created_at?: string;
}

export interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  sender?: Profile;
  content: string;
  read_at?: string | null;
  read_by?: { user_id: string; read_at: string }[];
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_for?: string[];
  created_at: string;
}


export interface Submission {
  id: string;
  project_id: string;
  project_title?: string;
  submitted_by: string;
  author?: Profile;
  title: string;
  description: string;
  status: SubmissionStatus;
  reviewed_by?: string | null;
  reviewer?: Profile | null;
  reviewed_at?: string | null;
  feedback?: string | null;
  created_at: string;
  files?: SubmissionFile[];
  comments?: SubmissionComment[];
}

export interface SubmissionFile {
  id: string;
  submission_id: string;
  file_name: string;
  file_size: string;
  file_url: string;
  file_type: string;
}

export interface SubmissionComment {
  id: string;
  submission_id: string;
  user_id: string;
  author?: Profile;
  comment: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'SUBMISSION' | 'VALIDATION' | 'MESSAGE' | 'PROJECT' | 'SYSTEM';
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  project_id?: string | null;
  project_title?: string;
  project_name?: string;
  user_id?: string;
  actor_id?: string;
  user?: Profile;
  action_type: 'SUBMIT_WORK' | 'APPROVE_WORK' | 'UPLOAD_FILE' | 'CREATE_PROJECT' | 'ASSIGN_MEMBER' | 'SEND_MESSAGE';
  action?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown> | null;
  description: string;
  target_name?: string;
  created_at: string;
}
