
export enum UserRole {
  STUDENT = 'Student',
  STUDENT_LEADER = 'Student Leader',
  ADVISER = 'Organization Adviser',
  ADMIN = 'Campus Admin',
}

export interface User {
  id?: string;
  email: string;
  name: string;
  profile_picture_url?: string;
  role: UserRole;
  organization?: string;
}

export enum DocumentType {
  ACTIVITY_PROPOSAL = 'Activity Proposal',
  BUDGET_REQ = 'Budgetary Requirements',
  RESOLUTION = 'Resolution',
  OFFICIAL_LETTER = 'Official Letter',
  CONSTITUTION = 'Constitution & By-Laws',
  MEETING_MINUTES = 'Meeting Minutes',
}

export interface DocumentVersion {
  id: string;
  content: string;
  savedAt: Date;
  versionNumber: number;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  type: DocumentType;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'Draft' | 'Final';
  versions?: DocumentVersion[];
}

export interface BudgetLineItem {
  id: string;
  item: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
