import React, { useEffect, useRef, useState } from 'react'
import InteractionForm, { type InteractionDraft } from '../components/InteractionForm'

type AiMessage = {
  id: string
  role: 'assistant' | 'user'
  title: string
  body: string
}

type StreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'final'; payload: any }

const today = new Date().toISOString().split('T')[0]
const introMessageId = 'assistant-intro'

const emptyDraft: InteractionDraft = {
  hcp_name: '',
  interaction_type: 'meeting',
  date: today,
  time: '',
  attendees: '',
  topics_discussed: '',
  materials_shared: '',
  samples_distributed: '',
  sentiment: 'neutral',
  outcomes: '',
  follow_up_actions: '',
}

function normalizeExtraction(payload: any): Partial<InteractionDraft> {
  const extracted = payload?.extracted_data ?? payload?.extracted ?? payload ?? {}

  const nextDraft: Partial<InteractionDraft> = {}

  if (extracted.hcp_name) nextDraft.hcp_name = extracted.hcp_name
  if (extracted.interaction_type) nextDraft.interaction_type = extracted.interaction_type
  if (extracted.date) nextDraft.date = extracted.date
  if (extracted.time) nextDraft.time = extracted.time
  if (extracted.attendees) nextDraft.attendees = extracted.attendees
  if (extracted.topics_discussed) nextDraft.topics_discussed = extracted.topics_discussed
  if (extracted.materials_shared) nextDraft.materials_shared = extracted.materials_shared
  if (extracted.samples_distributed) nextDraft.samples_distributed = extracted.samples_distributed
  if (extracted.sentiment) nextDraft.sentiment = extracted.sentiment
  if (extracted.outcomes) nextDraft.outcomes = extracted.outcomes
  if (extracted.follow_up_actions) nextDraft.follow_up_actions = extracted.follow_up_actions

  return nextDraft
}

export default function LogInteractionPage() {
  const [draft, setDraft] = useState<InteractionDraft>(emptyDraft)
  const [message, setMessage] = useState('')
  const [savedInteractionId, setSavedInteractionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: introMessageId,
      role: 'assistant',
      title: 'AI Assistant',
      body: 'Describe the interaction in plain English and I will fill the form on the left.',
    },
  ])
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, status, isStreaming])

  const runExtraction = async () => {
    if (!message.trim()) {
      setStatus('Type a short interaction summary first.')
      return
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      title: 'You',
      body: message,
    }
    const assistantMessageId = `assistant-${Date.now()}`

    setStatus('Streaming response...')
    setIsStreaming(true)
    setMessages((current) => {
      const withoutIntro = current.filter((entry) => entry.id !== introMessageId)
      return [
        ...withoutIntro,
        userMessage,
        {
          id: assistantMessageId,
          role: 'assistant',
          title: 'AI Assistant',
          body: '',
        },
      ]
    })

    try {
      const res = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ session_id: 'local', message: message.trim() }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Stream unavailable')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''

      const updateAssistantMessage = (body: string) => {
        setMessages((current) =>
          current.map((entry) =>
            entry.id === assistantMessageId ? { ...entry, body } : entry,
          ),
        )
      }

      const mergeDrafts = (current: InteractionDraft, next: Partial<InteractionDraft>, isFollowUp?: boolean) => {
        const merged: InteractionDraft = { ...current }
        Object.keys(next).forEach((key) => {
          const k = key as keyof InteractionDraft
          const val = next[k]
          if (k === 'attendees' && typeof val === 'string' && val.trim()) {
            const incoming = val.split(',').map((s) => s.trim()).filter(Boolean)
            const existing = (current.attendees || '').split(',').map((s) => s.trim()).filter(Boolean)
            const combined = Array.from(new Set([...existing, ...incoming]))
            merged.attendees = combined.join(', ')
            return
          }

          // When this is a follow-up-only update, avoid overwriting longer text fields like topics/materials
          if (isFollowUp && (k === 'topics_discussed' || k === 'materials_shared' || k === 'samples_distributed')) {
            return
          }

          if (val !== undefined) {
            merged[k] = val as any
          }
        })

        // Defensive: if this is a follow-up-only update, ensure we never overwrite long text fields
        if (isFollowUp) {
          merged.topics_discussed = current.topics_discussed
          merged.materials_shared = current.materials_shared
          merged.samples_distributed = current.samples_distributed
        }

        return merged
      }

      const processEvent = (event: StreamEvent) => {
        if (event.type === 'delta') {
          assistantText += event.content
          updateAssistantMessage(assistantText)
          return
        }

        const nextDraft = normalizeExtraction(event.payload)
        const isFollowUp = !!event.payload?.is_follow_up_only
        setDraft((current) => mergeDrafts(current, nextDraft, isFollowUp))

        if (!assistantText && event.payload?.assistant_response) {
          assistantText = event.payload.assistant_response
          updateAssistantMessage(assistantText)
        }

        setStatus('Fields auto-filled from your note.')
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        let newlineIndex = buffer.indexOf('\n')
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)

          if (line) {
            processEvent(JSON.parse(line) as StreamEvent)
          }

          newlineIndex = buffer.indexOf('\n')
        }
      }

      const trailingLine = buffer.trim()
      if (trailingLine) {
        processEvent(JSON.parse(trailingLine) as StreamEvent)
      }
    } catch (err) {
      try {
        const fallbackRes = await fetch('/api/v1/ai/chat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ session_id: 'local', message: message.trim() }),
        })
        const data = await fallbackRes.json()
        const nextDraft = normalizeExtraction(data)
        const isFollowUp = !!data?.is_follow_up_only
        setDraft((current) => mergeDrafts(current, nextDraft, isFollowUp))
        setMessages((current) =>
          current.map((entry) =>
            entry.id === assistantMessageId
              ? {
                  ...entry,
                  body:
                    data?.assistant_response ||
                    `I filled ${Object.values(nextDraft).filter(Boolean).length} fields from your note. Review the form on the left before saving.`,
                }
              : entry,
          ),
        )
        setStatus('Fields auto-filled from your note.')
      } catch (fallbackErr) {
        setStatus('AI request failed')
      }
    }
    finally {
      setMessage('')
      setIsStreaming(false)
    }
  }

  const saveInteraction = async () => {
    if (!draft.hcp_name || !draft.date) {
      setStatus('HCP name and date are required.')
      return
    }

    setIsSaving(true)
    setStatus('Saving...')
    try {
      const endpoint = savedInteractionId ? `/api/v1/interactions/${savedInteractionId}` : '/api/v1/interactions'
      const res = await fetch(endpoint, {
        method: savedInteractionId ? 'PATCH' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = typeof data?.detail === 'string' ? data.detail : 'Save failed'
        throw new Error(detail)
      }
      const nextId = data.id ?? data.interaction_id ?? savedInteractionId
      if (nextId == null) {
        throw new Error('Save failed: server did not return interaction id')
      }
      setSavedInteractionId(typeof nextId === 'number' ? nextId : savedInteractionId)
      setStatus(savedInteractionId ? `Updated interaction ${nextId}` : `Saved interaction ${nextId}`)
      setDraft(emptyDraft)
      setMessage('')
      setSavedInteractionId(null)
      setMessages([
        {
          id: introMessageId,
          role: 'assistant',
          title: 'AI Assistant',
          body: 'Describe the interaction in plain English and I will fill the form on the left.',
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setStatus(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.55),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-4 text-slate-900 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/65 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">AI-First CRM</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 md:text-3xl">Log HCP Interaction</h1>
          </div>
          <div className="hidden rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 md:block">
            AI assistant fills the form from your note
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_390px]">
          <InteractionForm
            value={draft}
            onChange={setDraft}
            onSave={saveInteraction}
            onReset={() => {
              setDraft(emptyDraft)
              setMessage('')
              setSavedInteractionId(null)
              setStatus('Draft reset.')
            }}
            isSaving={isSaving}
          />

          <aside className="self-start xl:sticky xl:top-4 flex h-[min(760px,calc(100vh-2rem))] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fbff]/95 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-600 text-sm font-semibold text-white shadow-lg shadow-sky-200">
                  AI
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">AI Assistant</p>
                  <p className="text-xs text-slate-500">Log interaction via chat</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((entry, index) => (
                <div
                  key={entry.id ?? `${entry.role}-${index}`}
                  className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                    entry.role === 'assistant'
                      ? 'border-sky-100/80 bg-gradient-to-br from-white to-sky-50/70 text-slate-700 shadow-[0_8px_24px_rgba(14,116,144,0.08)]'
                      : 'ml-auto max-w-[90%] border-transparent bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-[0_12px_30px_rgba(15,23,42,0.28)]'
                  }`}
                >
                  <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${entry.role === 'assistant' ? 'text-sky-700' : 'text-sky-200'}`}>
                    {entry.title}
                  </p>
                  <p className="whitespace-pre-line leading-7">{entry.body}</p>
                </div>
              ))}

              {status ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{status}</div> : null}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white/85 p-4 backdrop-blur">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-medium text-slate-700">Describe interaction...</label>
                <textarea
                  className="min-h-[82px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure."
                />
                <button
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  onClick={runExtraction}
                  disabled={isStreaming}
                  type="button"
                >
                  {isStreaming ? 'Streaming...' : 'Log'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
