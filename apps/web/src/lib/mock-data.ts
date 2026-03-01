import { Project, User, BlockChange, Document } from './types'

export const CURRENT_USER: User = {
  id: 'user-1',
  name: 'Hari Prasad',
  email: 'hari@flax.so',
  color: '#2563EB',
}

export const MOCK_USERS: User[] = [
  CURRENT_USER,
  {
    id: 'user-2',
    name: 'Sarah Chen',
    email: 'sarah@flax.so',
    color: '#7C3AED',
  },
  {
    id: 'user-3',
    name: 'Marcus Webb',
    email: 'marcus@flax.so',
    color: '#059669',
  },
]

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Flax Platform',
    description: 'Core product — editor, Mac app, and backend infrastructure',
    emoji: '⚡',
    color: '#2563EB',
    members: MOCK_USERS,
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-02-26'),
    documents: [
      {
        id: 'doc-1',
        title: 'Technical Design Doc',
        projectId: 'proj-1',
        createdBy: 'user-1',
        createdAt: new Date('2026-01-10'),
        updatedAt: new Date('2026-02-26'),
      },
      {
        id: 'doc-2',
        title: 'Product Requirements',
        projectId: 'proj-1',
        createdBy: 'user-1',
        createdAt: new Date('2026-01-12'),
        updatedAt: new Date('2026-02-20'),
      },
      {
        id: 'doc-3',
        title: 'API Documentation',
        projectId: 'proj-1',
        createdBy: 'user-2',
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-02-18'),
      },
    ],
  },
  {
    id: 'proj-2',
    name: 'Q1 Growth Initiative',
    description: 'Marketing campaign strategy and execution plan',
    emoji: '🚀',
    color: '#7C3AED',
    members: [MOCK_USERS[0], MOCK_USERS[1]],
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-02-24'),
    documents: [
      {
        id: 'doc-4',
        title: 'Campaign Strategy',
        projectId: 'proj-2',
        createdBy: 'user-2',
        createdAt: new Date('2026-01-05'),
        updatedAt: new Date('2026-02-24'),
      },
      {
        id: 'doc-5',
        title: 'Content Calendar',
        projectId: 'proj-2',
        createdBy: 'user-2',
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-02-22'),
      },
    ],
  },
  {
    id: 'proj-3',
    name: 'User Research',
    description: 'Interview notes, findings, and synthesis',
    emoji: '🔍',
    color: '#059669',
    members: [MOCK_USERS[0]],
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-25'),
    documents: [
      {
        id: 'doc-6',
        title: 'Interview Findings',
        projectId: 'proj-3',
        createdBy: 'user-1',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-25'),
      },
    ],
  },
]

// Block change history for doc-1 (Technical Design Doc)
export const MOCK_BLOCK_HISTORY: BlockChange[] = [
  {
    id: 'change-1',
    blockId: 'block-auth',
    docId: 'doc-1',
    timestamp: new Date('2026-01-10T10:00:00'),
    before: '',
    after: 'Auth will use JWT tokens for session management.',
    source: 'manual',
    author: MOCK_USERS[0],
    reason: 'Initial document creation',
  },
  {
    id: 'change-2',
    blockId: 'block-auth',
    docId: 'doc-1',
    timestamp: new Date('2026-02-15T14:30:00'),
    before: 'Auth will use JWT tokens for session management.',
    after: 'Auth will use JWT tokens with a 7-day refresh token rotation.',
    source: 'meeting',
    author: MOCK_USERS[0],
    meetingId: 'meeting-1',
    meetingTitle: 'Architecture Review',
    reason: 'Discussed session expiry UX — users were being logged out too frequently.',
  },
  {
    id: 'change-3',
    blockId: 'block-auth',
    docId: 'doc-1',
    timestamp: new Date('2026-02-26T11:00:00'),
    before: 'Auth will use JWT tokens with a 7-day refresh token rotation.',
    after: 'Auth will use session cookies with server-side sessions stored in Redis.',
    source: 'meeting',
    author: MOCK_USERS[1],
    meetingId: 'meeting-2',
    meetingTitle: 'Security Review',
    reason: 'Security review flagged JWT storage risks in localStorage. Switched to httpOnly session cookies.',
  },
  {
    id: 'change-4',
    blockId: 'block-db',
    docId: 'doc-1',
    timestamp: new Date('2026-01-10T10:00:00'),
    before: '',
    after: 'PostgreSQL for primary data store. Redis for caching.',
    source: 'manual',
    author: MOCK_USERS[0],
    reason: 'Initial document creation',
  },
  {
    id: 'change-5',
    blockId: 'block-db',
    docId: 'doc-1',
    timestamp: new Date('2026-02-20T09:00:00'),
    before: 'PostgreSQL for primary data store. Redis for caching.',
    after: 'PostgreSQL for primary data store. Redis for caching and session storage.',
    source: 'meeting',
    author: MOCK_USERS[2],
    meetingId: 'meeting-1',
    meetingTitle: 'Architecture Review',
    reason: 'Aligned with auth decision — Redis already in stack, use it for sessions too.',
  },
]

export const INITIAL_DOC_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, blockId: 'block-title' },
      content: [{ type: 'text', text: 'Technical Design Document' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'block-subtitle' },
      content: [
        { type: 'text', marks: [{ type: 'italic' }], text: 'Flax Platform · Last updated Feb 26, 2026' },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2, blockId: 'block-overview-heading' },
      content: [{ type: 'text', text: 'Overview' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'block-overview' },
      content: [
        {
          type: 'text',
          text: 'Flax is a context-aware documentation tool that auto-evolves based on what happens in meetings. Documents are collaborative and show the full history of every decision made.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2, blockId: 'block-arch-heading' },
      content: [{ type: 'text', text: 'Architecture' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'block-arch' },
      content: [
        {
          type: 'text',
          text: 'The system has two main parts: a React web editor and a native Swift Mac app. They communicate via a Node.js backend with WebSocket support.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2, blockId: 'block-auth-heading' },
      content: [{ type: 'text', text: 'Authentication' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'block-auth', changed: 'true' },
      content: [
        {
          type: 'text',
          text: 'Auth will use session cookies with server-side sessions stored in Redis.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2, blockId: 'block-db-heading' },
      content: [{ type: 'text', text: 'Data Storage' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'block-db', changed: 'true' },
      content: [
        {
          type: 'text',
          text: 'PostgreSQL for primary data store. Redis for caching and session storage.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2, blockId: 'block-collab-heading' },
      content: [{ type: 'text', text: 'Real-time Collaboration' }],
    },
    {
      type: 'paragraph',
      attrs: { blockId: 'block-collab' },
      content: [
        {
          type: 'text',
          text: 'Documents support real-time collaborative editing via Yjs CRDTs and Hocuspocus WebSocket server. Multiple users can edit simultaneously with cursor presence.',
        },
      ],
    },
  ],
}

export function getDocById(id: string): Document | undefined {
  return MOCK_PROJECTS.flatMap((p) => p.documents).find((d) => d.id === id)
}

export function getProjectByDocId(docId: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.documents.some((d) => d.id === docId))
}

export function getBlockHistory(blockId: string, docId: string): BlockChange[] {
  return MOCK_BLOCK_HISTORY.filter(
    (c) => c.blockId === blockId && c.docId === docId
  ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}
