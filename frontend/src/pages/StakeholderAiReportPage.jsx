import { useEffect, useRef, useState } from 'react'
import { askAiReport } from '../api/stakeholder.js'
import Icon from '../components/Icon.jsx'

// Conversational report page for the Stakeholder — the flow follows the
// familiar assistant pattern (start screen with suggested prompts →
// question → thinking indicator → answer, with a composer for
// follow-ups) but every answer is grounded: the backend computes the
// figures and the model only phrases them (app/report_summary.py's
// generate_report_answer). The conversation lives in sessionStorage so
// navigating to a submission and back doesn't lose it; "New chat"
// clears it.

const STORAGE_KEY = 'mplads_ai_report_chat'

// Starter prompts, phrased as the questions a sign-off officer actually
// starts their day with. Clicking one sends it verbatim.
const SUGGESTIONS = [
  {
    label: "Today's briefing",
    icon: 'shield',
    question:
      'Give me a briefing on where the pipeline stands right now: volume, risk levels, bottlenecks, and anything unusual.',
  },
  {
    label: 'What needs my sign-off?',
    icon: 'check',
    question:
      'Which submissions are approved and waiting for my sign-off, and what risk level did each score?',
  },
  {
    label: 'Which districts look risky?',
    icon: 'location',
    question: 'Which districts have the most HIGH-risk submissions, and how do the districts compare?',
  },
  {
    label: 'Why are submissions flagged?',
    icon: 'alert',
    question: 'What are the most common fraud flags raised across submissions so far?',
  },
]

function loadStoredTurns() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function StakeholderAiReportPage() {
  const [turns, setTurns] = useState(loadStoredTurns)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  // 'not_configured' hides the whole conversational UI (nothing the user
  // can do about it); a transient failure stays inline so they can retry.
  const [notConfigured, setNotConfigured] = useState(false)
  const [failedQuestion, setFailedQuestion] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns))
    } catch {
      // storage full/blocked — the chat just won't survive navigation
    }
  }, [turns])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, busy])

  async function send(question) {
    const text = question.trim()
    if (!text || busy) return
    setFailedQuestion(null)
    setInput('')
    // History is what's visible BEFORE this question — the backend
    // appends the question itself.
    const history = turns.map((t) => ({ role: t.role, text: t.text }))
    setTurns((prev) => [...prev, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await askAiReport(text, history)
      if (res.available) {
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', text: res.answer, model: res.model, at: res.generated_at },
        ])
      } else if (res.reason === 'not_configured') {
        setNotConfigured(true)
      } else {
        setFailedQuestion(text)
      }
    } catch {
      setFailedQuestion(text)
    } finally {
      setBusy(false)
    }
  }

  function newChat() {
    setTurns([])
    setFailedQuestion(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  if (notConfigured) {
    return (
      <div className="ai-report">
        <div className="page-header">
          <div>
            <h1>AI Report</h1>
            <p>Ask about your verification pipeline and get grounded answers.</p>
          </div>
        </div>
        <div className="card card-padded">
          The AI assistant isn't configured on this server (no Gemini API key). The{' '}
          numbers themselves are always available on the Dashboard and Reports pages.
        </div>
      </div>
    )
  }

  const empty = turns.length === 0

  return (
    <div className="ai-report">
      <div className="page-header">
        <div>
          <h1>AI Report</h1>
          <p>Ask about your verification pipeline — answers use only figures the system computed.</p>
        </div>
        {!empty && (
          <button type="button" className="btn btn-secondary" onClick={newChat} disabled={busy}>
            <Icon name="refresh" size={15} />
            New chat
          </button>
        )}
      </div>

      {empty && !busy && (
        <div className="ai-report-hero">
          <div className="ai-report-hero-title">What do you want to know?</div>
          <div className="ai-report-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s.label} type="button" className="ai-report-chip" onClick={() => send(s.question)}>
                <Icon name={s.icon} size={16} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ai-report-thread">
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="ai-report-question">
              {t.text}
            </div>
          ) : (
            <AssistantTurn key={i} turn={t} />
          )
        )}

        {busy && (
          <div className="ai-report-answer">
            <span className="ai-report-avatar is-thinking" />
            <div className="ai-report-thinking">
              <span className="shimmer-line" style={{ width: '92%' }} />
              <span className="shimmer-line" style={{ width: '78%' }} />
              <span className="shimmer-line" style={{ width: '55%' }} />
            </div>
          </div>
        )}

        {failedQuestion && !busy && (
          <div className="ai-report-answer">
            <span className="ai-report-avatar" />
            <div>
              <p style={{ margin: 0, color: 'var(--color-muted)' }}>
                That answer didn't come through. The figures are unchanged — it's safe to retry.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 10 }}
                onClick={() => {
                  // Drop the dangling user turn so the retry doesn't duplicate it.
                  setTurns((prev) => prev.slice(0, -1))
                  send(failedQuestion)
                }}
              >
                <Icon name="refresh" size={15} />
                Try again
              </button>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form
        className="ai-report-composer"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={empty ? 'Ask about volume, districts, risk, sign-offs…' : 'Ask a follow-up…'}
          maxLength={2000}
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
      <p className="ai-report-disclaimer">
        Figures are computed by the system; the AI only phrases them. Verify a submission on its
        report page before signing off.
      </p>
    </div>
  )
}

function AssistantTurn({ turn }) {
  return (
    <div className="ai-report-answer reveal">
      <span className="ai-report-avatar" />
      <div style={{ minWidth: 0 }}>
        {turn.text.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0', lineHeight: 1.65 }}>
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  )
}
