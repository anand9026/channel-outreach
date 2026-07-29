import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { useEffect } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

/**
 * Rich HTML editor used for Email templates.
 * Emits HTML (safe for Gmail template body) via `onChange`.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 180 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit already ships Underline in v3, but we register it
        // explicitly so keyboard shortcuts always fire.
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener' } }),
      Placeholder.configure({ placeholder: placeholder || 'Write your email…' }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  // Sync when caller resets content (e.g. modal reopens).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if ((value || '') !== current && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const promptLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const btn = (
    active: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode,
    testId: string,
  ) => (
    <button
      type="button"
      className={`rx-rte-btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
    >
      {icon}
    </button>
  )

  return (
    <div className="rx-rte">
      <div className="rx-rte-toolbar" role="toolbar" aria-label="Formatting">
        {btn(
          editor.isActive('bold'),
          () => editor.chain().focus().toggleBold().run(),
          'Bold (⌘B)',
          <Bold size={13} />,
          'rte-bold',
        )}
        {btn(
          editor.isActive('italic'),
          () => editor.chain().focus().toggleItalic().run(),
          'Italic (⌘I)',
          <Italic size={13} />,
          'rte-italic',
        )}
        {btn(
          editor.isActive('underline'),
          () => editor.chain().focus().toggleUnderline().run(),
          'Underline (⌘U)',
          <UnderlineIcon size={13} />,
          'rte-underline',
        )}
        <span className="rx-rte-sep" />
        {btn(
          editor.isActive('heading', { level: 1 }),
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          'Heading 1',
          <Heading1 size={13} />,
          'rte-h1',
        )}
        {btn(
          editor.isActive('heading', { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          'Heading 2',
          <Heading2 size={13} />,
          'rte-h2',
        )}
        <span className="rx-rte-sep" />
        {btn(
          editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run(),
          'Bulleted list',
          <List size={13} />,
          'rte-ul',
        )}
        {btn(
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run(),
          'Numbered list',
          <ListOrdered size={13} />,
          'rte-ol',
        )}
        {btn(
          editor.isActive('blockquote'),
          () => editor.chain().focus().toggleBlockquote().run(),
          'Quote',
          <Quote size={13} />,
          'rte-quote',
        )}
        <span className="rx-rte-sep" />
        {btn(editor.isActive('link'), promptLink, 'Insert link', <LinkIcon size={13} />, 'rte-link')}
        <span className="rx-rte-spacer" />
        {btn(
          false,
          () => editor.chain().focus().undo().run(),
          'Undo',
          <Undo2 size={13} />,
          'rte-undo',
        )}
        {btn(
          false,
          () => editor.chain().focus().redo().run(),
          'Redo',
          <Redo2 size={13} />,
          'rte-redo',
        )}
      </div>
      <EditorContent
        editor={editor}
        className="rx-rte-content"
        style={{ minHeight }}
        data-testid="rte-content"
      />
    </div>
  )
}
