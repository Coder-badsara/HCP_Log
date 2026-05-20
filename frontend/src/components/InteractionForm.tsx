import React from 'react'

export type InteractionDraft = {
  hcp_name: string
  interaction_type: string
  date: string
  time: string
  attendees: string
  topics_discussed: string
  materials_shared: string
  samples_distributed: string
  sentiment: string
  outcomes: string
  follow_up_actions: string
}

type InteractionFormProps = {
  value: InteractionDraft
  onChange: (next: InteractionDraft) => void
  onSave: () => void
  onReset: () => void
  isSaving?: boolean
}

function updateField(
  value: InteractionDraft,
  onChange: (next: InteractionDraft) => void,
  key: keyof InteractionDraft,
  nextValue: string,
) {
  onChange({ ...value, [key]: nextValue })
}

export default function InteractionForm({ value, onChange, onSave, onReset, isSaving = false }: InteractionFormProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Interaction Details</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Log HCP Interaction</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          Auto-filled by AI
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-1">
          <span className="mb-1 block text-sm font-medium text-slate-700">HCP Name</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Search or select HCP..."
            value={value.hcp_name}
            onChange={(event) => updateField(value, onChange, 'hcp_name', event.target.value)}
          />
        </label>

        <label className="md:col-span-1">
          <span className="mb-1 block text-sm font-medium text-slate-700">Interaction Type</span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={value.interaction_type}
            onChange={(event) => updateField(value, onChange, 'interaction_type', event.target.value)}
          >
            <option value="meeting">Meeting</option>
            <option value="detail_visit">Detail Visit</option>
            <option value="call">Call</option>
            <option value="follow_up">Follow-up</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            type="date"
            value={value.date}
            onChange={(event) => updateField(value, onChange, 'date', event.target.value)}
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-slate-700">Time</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            type="time"
            value={value.time}
            onChange={(event) => updateField(value, onChange, 'time', event.target.value)}
          />
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Attendees</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Enter names or search..."
            value={value.attendees}
            onChange={(event) => updateField(value, onChange, 'attendees', event.target.value)}
          />
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Topics Discussed</span>
          <textarea
            className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Enter key discussion points..."
            value={value.topics_discussed}
            onChange={(event) => updateField(value, onChange, 'topics_discussed', event.target.value)}
          />
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Materials Shared / Samples Distributed</span>
          <input
            className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Materials shared"
            value={value.materials_shared}
            onChange={(event) => updateField(value, onChange, 'materials_shared', event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Samples distributed"
            value={value.samples_distributed}
            onChange={(event) => updateField(value, onChange, 'samples_distributed', event.target.value)}
          />
        </label>

        <div className="md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-slate-700">Observed / Inferred HCP Sentiment</span>
          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
            {['positive', 'neutral', 'negative'].map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${
                  value.sentiment === option
                    ? 'border-sky-400 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  className="accent-sky-600"
                  type="radio"
                  name="sentiment"
                  value={option}
                  checked={value.sentiment === option}
                  onChange={(event) => updateField(value, onChange, 'sentiment', event.target.value)}
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Outcomes</span>
          <textarea
            className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Key outcomes or agreements..."
            value={value.outcomes}
            onChange={(event) => updateField(value, onChange, 'outcomes', event.target.value)}
          />
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Follow-up Actions</span>
          <textarea
            className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Enter next steps or tasks..."
            value={value.follow_up_actions}
            onChange={(event) => updateField(value, onChange, 'follow_up_actions', event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Interaction'}
        </button>
        <button
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onReset}
          type="button"
        >
          Reset Draft
        </button>
      </div>
    </section>
  )
}
