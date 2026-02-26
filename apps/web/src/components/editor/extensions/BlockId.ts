import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { nanoid } from 'nanoid'

/**
 * Assigns a stable `data-block-id` to every block node.
 * This is the core primitive for Flax's version history —
 * each block can be tracked individually across meetings.
 */
export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'bulletList',
          'orderedList',
          'listItem',
          'taskList',
          'taskItem',
          'codeBlock',
          'blockquote',
          'horizontalRule',
        ],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-block-id'),
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.blockId) return {}
              return { 'data-block-id': attrs.blockId }
            },
          },
          changed: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-changed'),
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.changed) return {}
              return { 'data-changed': attrs.changed }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockId'),
        appendTransaction(transactions, _oldState, newState) {
          const docChanges = transactions.some(
            (tr) => tr.docChanged && !tr.getMeta('preventAutoBlockId')
          )
          if (!docChanges) return

          const { tr } = newState
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (
              node.isBlock &&
              node.type.name !== 'doc' &&
              !node.attrs.blockId
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                blockId: nanoid(10),
              })
              modified = true
            }
          })

          if (modified) {
            tr.setMeta('preventAutoBlockId', true)
            return tr
          }
        },
      }),
    ]
  },
})
