'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { BlockId } from './extensions/BlockId'
import { EditorBubbleMenu } from './EditorBubbleMenu'
import { useEditorStore } from '@/stores/editor-store'
import { getBlockHistory } from '@/lib/mock-data'
import { useEffect, useRef } from 'react'

interface FlaxEditorProps {
  docId: string
  initialContent?: object
  editable?: boolean
}

export function FlaxEditor({ docId, initialContent, editable = true }: FlaxEditorProps) {
  const { openHistoryPanel } = useEditorStore()
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading'
          return "Write something, or press '/' for commands…"
        },
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      CharacterCount,
      Typography,
      BlockId,
    ],
    content: initialContent || '',
    editable,
    editorProps: {
      attributes: {
        class: 'flax-editor min-h-[60vh] focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Handle clicks on changed-indicator blocks
  useEffect(() => {
    if (!editorWrapperRef.current) return

    const handleClick = (e: Event) => {
      const mouseEvent = e as unknown as MouseEvent
      const target = mouseEvent.target as HTMLElement
      const block = target.closest('[data-changed="true"]') as HTMLElement | null
      if (!block) return

      // Check if click is in the gutter area (left of text)
      const rect = block.getBoundingClientRect()
      if (mouseEvent.clientX > rect.left + 20) return // only intercept gutter clicks

      const blockId = block.getAttribute('data-block-id')
      if (!blockId) return

      const history = getBlockHistory(blockId, docId)
      if (history.length > 0) {
        openHistoryPanel(blockId)
      }
    }

    const wrapper = editorWrapperRef.current
    wrapper.addEventListener('click', handleClick)
    return () => wrapper.removeEventListener('click', handleClick)
  }, [docId, openHistoryPanel])

  if (!editor) return null

  return (
    <div ref={editorWrapperRef} className="relative">
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      {/* Character count */}
      <div className="mt-6 flex items-center justify-end text-xs text-[var(--color-text-faint)]">
        {editor.storage.characterCount?.characters() ?? 0} characters
      </div>
    </div>
  )
}
