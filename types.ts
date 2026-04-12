import { FileText, Mail, Scale } from 'lucide-react';
export enum UserRole {
  OFFICER = 'officer',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export type SpecificRole =
  | 'CITE Governor' | 'CAS Governor' | 'CBM Governor' | 'CTE Governor' | 'CET Governor' | 'USG President' | 'University Official'
  | 'Vice Governor' | 'Secretary' | 'Treasurer' | 'Auditor' | 'P.I.O' | 'Business Manager' | 'Sgt. at Arms' | 'Other'
  | 'CITE Secretary' | 'CET Secretary' | 'CTE Secretary' | 'CAS Secretary' | 'CBM Secretary';

export type Department = 
  | 'CITE' | 'CAS' | 'CBM' | 'CTE' | 'CET' | 'USG' | 'System Administration'
  | 'College of Information Technology Education'
  | 'College of Engineering Technology'
  | 'College of Teacher Education'
  | 'Department of Social Sciences (DSS) Secretary'
  | 'Department of Languages (DOL) Secretary'
  | 'Department of Mathematics & Natural Sciences (DMNS) Secretary'
  | 'Department of Business Management (DBM) Secretary'
  | 'Department of Hospitality Management (DHM) Secretary'
  | 'Department of Public Administration (DPA) Secretary';

export interface UserPermissions {
  official_letter?: 'view' | 'edit';
  activity_proposal?: 'view' | 'edit';
  constitution?: 'view' | 'edit';
  [key: string]: 'view' | 'edit' | undefined;
}

export interface User {
  id: string; // Auth ID
  email: string;
  full_name: string;
  avatar_url?: string;

  // Active Role Data
  role_id?: string; // UUID from user_roles
  user_type?: UserRole;
  specific_role?: string;
  department?: string;
  permissions?: UserPermissions;
  status?: 'pending' | 'active' | 'rejected' | 'disabled';
}

export enum DocumentType {
  ACTIVITY_PROPOSAL = 'Activity Proposal',
  OFFICIAL_LETTER = 'Official Letter',
  CONSTITUTION = 'Constitution & By-Laws',
}

export const DocumentTypePermissionKey: Record<DocumentType, keyof UserPermissions> = {
  [DocumentType.ACTIVITY_PROPOSAL]: 'activity_proposal',
  [DocumentType.OFFICIAL_LETTER]: 'official_letter',
  [DocumentType.CONSTITUTION]: 'constitution',
};

export const DocumentTypeIcon = {
  [DocumentType.ACTIVITY_PROPOSAL]: FileText,
  [DocumentType.OFFICIAL_LETTER]: Mail,
  [DocumentType.CONSTITUTION]: Scale,
};

export const DocumentTypeColor = {
  [DocumentType.ACTIVITY_PROPOSAL]: 'bg-blue-600',
  [DocumentType.OFFICIAL_LETTER]: 'bg-blue-600',
  [DocumentType.CONSTITUTION]: 'bg-blue-600',
};

export interface DocumentVersion {
  id: string;
  content: string;
  savedAt: Date;
  versionNumber: number;
  modifiedBy?: {
    id: string;
    name: string;
  };
}

export interface GeneratedDocument {
  id: string;
  title: string;
  type: DocumentType;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'Draft' | 'Final' | 'Archived';
  versions?: DocumentVersion[];
  department?: string;
  visibility?: 'private' | 'department';
  school_year?: string;
  user_id?: string;
  author_name?: string;
  author_avatar?: string;
  template_index?: number;
  templateUrl?: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Template {
  id: string;
  department: string;
  document_type: string;
  content: string;
  updated_at: string;
}

export interface Dataset {
  id: string;
  department: string;
  document_type: string;
  file_url: string;
  description?: string;
  created_at: string;
}
