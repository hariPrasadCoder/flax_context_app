export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  color: string // for collab cursor
}

export interface Project {
  id: string
  name: string
  description?: string
  emoji: string
  color: string
  documents: Document[]
  members: User[]
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  title: string
  projectId: string
  parentId?: string // for nested docs
  children?: Document[]
  content?: object // TipTap JSON
  createdBy: string
  updatedAt: Date
  createdAt: Date
}

export type ChangeSource = 'manual' | 'meeting' | 'ai'

export interface BlockChange {
  id: string
  blockId: string
  docId: string
  timestamp: Date
  before: string
  after: string
  source: ChangeSource
  author?: User
  meetingId?: string
  meetingTitle?: string
  reason?: string
}

export interface Meeting {
  id: string
  title: string
  docId: string
  date: Date
  duration: number // minutes
  transcript?: string
  changesProposed?: ProposedChange[]
}

export interface ProposedChange {
  id: string
  blockId: string
  before: string
  after: string
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
}
