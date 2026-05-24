import React, { useEffect, useRef, useState } from 'react'
import InteractionForm, { type InteractionDraft } from '../components/InteractionForm'

type AiMessage = {
  id: string
  role: 'assistant' | 'user'
  title: string
  body: string
}

type MessageBubbleProps = {
  entry: AiMessage
  index: number
  isPendingAssistant?: boolean
}

function RobotIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 4.5h6A2.5 2.5 0 0 1 17.5 7v1H19a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1.5v1A2.5 2.5 0 0 1 15 20.5H9A2.5 2.5 0 0 1 6.5 18v-1H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h1.5V7A2.5 2.5 0 0 1 9 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M9.5 8.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" />
      <path d="M9 15.5c.9.7 1.8 1 3 1s2.1-.3 3-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 2.5v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="2.2" r="0.9" fill="currentColor" />
    </svg>
  )
}

function ThinkingDots() {
  return (
    <span className="thinking-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function MessageBubble({ entry, index, isPendingAssistant = false }: MessageBubbleProps) {
  const isAssistant = entry.role === 'assistant'

  return (
    <div
      key={entry.id ?? `${entry.role}-${index}`}
      className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
        isAssistant
          ? 'border-sky-100/80 bg-gradient-to-br from-white to-sky-50/70 text-slate-700 shadow-[0_8px_24px_rgba(14,116,144,0.08)]'
          : 'ml-auto max-w-[90%] border-transparent bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-[0_12px_30px_rgba(15,23,42,0.28)]'
      }`}
    >
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${isAssistant ? 'text-sky-700' : 'text-sky-200'}`}>
        {entry.title}
      </p>

      {isPendingAssistant ? (
        <div className="flex items-start gap-3">
          <div className="robot-badge mt-0.5">
            <RobotIcon className="h-4 w-4" />
          </div>
          <div className="flex min-h-[1.75rem] items-center gap-2 text-slate-500">
            <ThinkingDots />
            <span>Thinking</span>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line leading-7">{entry.body}</p>
      )}
    </div>
  )
}

const today = new Date().toISOString().split('T')[0]
const introMessageId = 'assistant-intro'
const interactionTypeOptions = ['meeting', 'detail_visit', 'call', 'follow_up'] as const
const sentimentOptions = ['positive', 'neutral', 'negative'] as const

function getCurrentTimeValue() {
  return new Date().toTimeString().slice(0, 5)
}

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

function normalizeOptionValue(value: unknown, options: readonly string[], fallback: string) {
  if (typeof value === 'number' && options[value]) {
    return options[value]
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    const matchIndex = options.findIndex((option) => option === normalized)
    if (matchIndex >= 0) {
      return options[matchIndex]
    }
  }

  return fallback
}

function parseMaybeJson(rawText: string) {
  if (!rawText) {
    return {}
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return { detail: rawText }
  }
}

function normalizeResponseFormValues(payload: any, current: InteractionDraft): Partial<InteractionDraft> {
  const extracted = payload?.form_values ?? payload?.extracted_data ?? payload?.extracted ?? payload ?? {}

  const nextDraft: Partial<InteractionDraft> = {}

  if (extracted.hcp_name) nextDraft.hcp_name = extracted.hcp_name
  nextDraft.interaction_type = normalizeOptionValue(
    extracted.interaction_type_index ?? extracted.interaction_type,
    interactionTypeOptions,
    current.interaction_type,
  )
  if (extracted.date) nextDraft.date = extracted.date
  if (extracted.time) nextDraft.time = extracted.time
  if (extracted.attendees) nextDraft.attendees = extracted.attendees
  if (extracted.topics_discussed) nextDraft.topics_discussed = extracted.topics_discussed
  if (extracted.materials_shared) nextDraft.materials_shared = extracted.materials_shared
  if (extracted.samples_distributed) nextDraft.samples_distributed = extracted.samples_distributed
  nextDraft.sentiment = normalizeOptionValue(
    extracted.sentiment_index ?? extracted.sentiment,
    sentimentOptions,
    current.sentiment,
  )
  if (extracted.outcomes) nextDraft.outcomes = extracted.outcomes
  if (extracted.follow_up_actions) nextDraft.follow_up_actions = extracted.follow_up_actions

  return nextDraft
}

export default function LogInteractionPage() {
  const [draft, setDraft] = useState<InteractionDraft>(emptyDraft)
  const [message, setMessage] = useState('')
  const [savedInteractionId, setSavedInteractionId] = useState<number | null>(null)
  const [pendingAssistantMessageId, setPendingAssistantMessageId] = useState<string | null>(null)
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
    setPendingAssistantMessageId(assistantMessageId)

    const currentTimeValue = draft.time || getCurrentTimeValue()
    const currentFormValues = {
      ...draft,
      time: currentTimeValue,
    }

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          session_id: 'local',
          message: message.trim(),
          current_form_values: currentFormValues,
        }),
      })

      if (!res.ok) {
        throw new Error('Request failed')
      }

      const data = await res.json()

      setDraft((current) => ({
        ...current,
        ...normalizeResponseFormValues(data, current),
      }))

      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId
            ? {
                ...entry,
                body:
                  data?.response ||
                  'I filled the form with the details I could extract from your note.',
              }
            : entry,
        ),
      )

      setStatus('Fields are auto filled by AI Assistant.')
    } catch (err) {
      setStatus('AI request failed')
    }
    finally {
      setMessage('')
      setIsStreaming(false)
      setPendingAssistantMessageId(null)
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
      const rawText = await res.text()
      const data = parseMaybeJson(rawText)
      if (!res.ok) {
        const detail = typeof data?.detail === 'string' ? data.detail : rawText || 'Save failed'
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
                <div className="robot-badge h-10 w-10 text-sky-700">
                  <RobotIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">AI Assistant</p>
                  <p className="text-xs text-slate-500">Log interaction via chat</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((entry, index) => (
                <MessageBubble
                  key={entry.id ?? `${entry.role}-${index}`}
                  entry={entry}
                  index={index}
                  isPendingAssistant={entry.id === pendingAssistantMessageId && isStreaming}
                />
              ))}

              {status ? (
                <div className="status-card flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
                  <div className="robot-badge text-sky-700">
                    <RobotIcon className="h-4 w-4" />
                  </div>
                  <span>{status}</span>
                </div>
              ) : null}
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
                  {isStreaming ? 'Thinking...' : 'Log'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
