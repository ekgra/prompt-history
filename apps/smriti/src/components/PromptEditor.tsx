import { useCallback, useEffect, useRef, useState, useId } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import { Markdown } from 'tiptap-markdown'
import History from '@tiptap/extension-history'

function Button({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`tb-btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!!active}
      title={title}
    >
      {children}
    </button>
  )
}

export default function PromptEditor({
  initialDoc,
  initialSelection,
  onDocChange,
}: {
  initialDoc?: unknown
  initialSelection?: { from: number; to: number } | null
  onDocChange?: (docJson: unknown, selection: { from: number; to: number } | null) => void
}) {
  const [copyMode, setCopyMode] = useState<'raw' | 'md'>('raw')
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()
  const editor = useEditor({
    autofocus: true,
    extensions: [
      StarterKit.configure({ history: false }),
      History.configure({ depth: 200 }),
      Underline,
      Image,
      Placeholder.configure({ placeholder: 'start typing …' }),
      Markdown.configure({
        // keep defaults; extension exposes getMarkdown/setMarkdown APIs
      }) as any,
    ],
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'true',
      },
    },
    content: (initialDoc as any) ?? '',
    onUpdate: ({ editor }) => {
      const sel = editor.state.selection
      const selection = sel ? { from: sel.from, to: sel.to } : null
      onDocChange?.(editor.getJSON(), selection)
    },
  })

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const importMarkdown = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    try {
      const text = await file.text()
      const anyEditor = editor as any
      if (anyEditor?.commands?.setMarkdown) {
        anyEditor.commands.setMarkdown(text)
      } else {
        // Fallback: insert as code block if Markdown extension API is unavailable
        editor.chain().focus().setCodeBlock().insertContent(text).run()
      }
    } catch (err) {
      console.error('Failed to import markdown', err)
    } finally {
      e.target.value = ''
    }
  }, [editor])

  const exportMarkdown = useCallback(() => {
    if (!editor) return
    let md = ''
    try {
      const storage = (editor as any).storage
      if (storage?.markdown?.getMarkdown) {
        md = storage.markdown.getMarkdown()
      } else {
        // Fallback: use plain text if markdown serializer not available
        md = editor.getText()
      }
    } catch (e) {
      md = editor.getText()
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'prompt.md'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [editor])

  const copyToClipboard = useCallback(async () => {
    if (!editor) return
    let text = ''
    if (copyMode === 'raw') {
      text = editor.getText()
    } else {
      try {
        const storage = (editor as any).storage
        text = storage?.markdown?.getMarkdown ? storage.markdown.getMarkdown() : editor.getText()
      } catch {
        text = editor.getText()
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (e) {
      console.error('Copy failed', e)
    }
  }, [editor, copyMode])

  // Close the copy-mode menu on outside click or Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuOpen) return
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!editor) return
    const handler = (e: KeyboardEvent) => {
      const mac = navigator.platform.toUpperCase().includes('MAC')
      const mod = mac ? e.metaKey : e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        editor.commands.undo()
      } else if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        editor.commands.redo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editor])

  // Apply initial content and selection after first load
  const hasAppliedInitialRef = useRef(false)
  useEffect(() => {
    if (!editor) return
    if (hasAppliedInitialRef.current) return
    if (typeof initialDoc !== 'undefined') {
      try {
        editor.commands.setContent(initialDoc as any, false)
      } catch {}
      if (initialSelection && typeof initialSelection.from === 'number' && typeof initialSelection.to === 'number') {
        try {
          editor.commands.setTextSelection({ from: initialSelection.from, to: initialSelection.to })
        } catch {}
      }
      hasAppliedInitialRef.current = true
    }
  }, [editor, initialDoc, initialSelection])

  if (!editor) return null

  const can = (cb: (e: TiptapEditor) => boolean) => {
    try { return editor ? cb(editor as TiptapEditor) : false } catch { return false }
  }

  return (
    <div className="prompt-editor">
      <div className="toolbar" role="toolbar" aria-label="Formatting toolbar">
        <Button
          title="Bold (Ctrl/Cmd+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={!can(e => e.can().chain().focus().toggleBold().run())}
        >
          B
        </Button>
        <Button
          title="Italic (Ctrl/Cmd+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={!can(e => e.can().chain().focus().toggleItalic().run())}
        >
          I
        </Button>
        <Button
          title="Underline (Ctrl/Cmd+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          disabled={!can(e => e.can().chain().focus().toggleUnderline().run())}
        >
          U
        </Button>
        <Button
          title="Inline code (Ctrl/Cmd+E)"
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          disabled={!can(e => e.can().chain().focus().toggleCode().run())}
        >
          {'</>'}
        </Button>

        <span className="tb-sep" aria-hidden="true" />

        <Button
          title="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          disabled={!can(e => e.can().chain().focus().toggleHeading({ level: 1 }).run())}
        >
          H1
        </Button>
        <Button
          title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          disabled={!can(e => e.can().chain().focus().toggleHeading({ level: 2 }).run())}
        >
          H2
        </Button>

        <span className="tb-sep" aria-hidden="true" />

        <Button
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          disabled={!can(e => e.can().chain().focus().toggleBulletList().run())}
        >
          • List
        </Button>
        <Button
          title="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          disabled={!can(e => e.can().chain().focus().toggleOrderedList().run())}
        >
          1. List
        </Button>

        <span className="tb-sep" aria-hidden="true" />

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        <Button title="Import Markdown (.md)" onClick={importMarkdown}>Import MD</Button>
        <Button title="Export Markdown (.md)" onClick={exportMarkdown}>Export MD</Button>

        <span className="tb-sep" aria-hidden="true" />

        <div className="split-copy" ref={menuWrapRef}>
          <button
            type="button"
            className="tb-btn copy-main"
            onClick={copyToClipboard}
            title={copyMode === 'raw' ? 'Copy raw text' : 'Copy Markdown text'}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button
            type="button"
            className="tb-btn copy-caret"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen(v => !v)}
            title="Copy options"
          >
            ▾
          </button>
          {menuOpen && (
            <div className="copy-menu" role="menu" id={menuId}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={copyMode === 'raw'}
                className="menu-item"
                onClick={() => { setCopyMode('raw'); setMenuOpen(false) }}
              >
                Raw text
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={copyMode === 'md'}
                className="menu-item"
                onClick={() => { setCopyMode('md'); setMenuOpen(false) }}
              >
                Markdown
              </button>
            </div>
          )}
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
