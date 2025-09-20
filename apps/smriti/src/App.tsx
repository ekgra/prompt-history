import { useEffect, useId, useRef, useState } from 'react'
import PromptEditor from './components/PromptEditor'
import { useAutosave } from './lib/autosave'

function SrOnlyLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label className="sr-only" htmlFor={htmlFor}>
      {children}
    </label>
  )
}

export default function App() {
  const projectId = useId()
  const promptId = useId()
  const [projectName, setProjectName] = useState('')
  const [promptName, setPromptName] = useState('')

  // Use a simple fixed draftId for now; later derive from names
  const draftId = 'current'
  const { draft, saving, onChange } = useAutosave(draftId)
  const initializedRef = useRef(false)

  // Initialize local state from draft once
  useEffect(() => {
    if (initializedRef.current) return
    if (draft) {
      setProjectName(draft.projectName ?? '')
      setPromptName(draft.promptName ?? '')
      initializedRef.current = true
    }
  }, [draft])

  return (
    <div className="app-root">
      <main className="card" role="main">
        <header className="card-header">
          <h1 className="brand" aria-label="smriti">smṛti</h1>
          <div className="names-row">
            <div className="input-wrap">
              <SrOnlyLabel htmlFor={projectId}>Project name</SrOnlyLabel>
              <input
                id={projectId}
                className="name-input"
                type="text"
                placeholder="project name"
                value={projectName}
                onChange={(e) => { setProjectName(e.target.value); onChange({ projectName: e.target.value }) }}
                spellCheck={false}
              />
            </div>
            <span className="slash" aria-hidden="true">/</span>
            <div className="input-wrap">
              <SrOnlyLabel htmlFor={promptId}>Prompt name</SrOnlyLabel>
              <input
                id={promptId}
                className="name-input"
                type="text"
                placeholder="prompt name"
                value={promptName}
                onChange={(e) => { setPromptName(e.target.value); onChange({ promptName: e.target.value }) }}
                spellCheck={false}
              />
            </div>
          </div>
        </header>

        <section className="editor-shell" aria-label="Editor">
          <PromptEditor
            initialDoc={draft?.docJson}
            initialSelection={draft?.selection ?? null}
            onDocChange={(docJson, selection) => onChange({ docJson, selection })}
          />
        </section>

        <button className="save-btn" disabled aria-disabled="true" aria-label="Save">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </main>
    </div>
  )
}
