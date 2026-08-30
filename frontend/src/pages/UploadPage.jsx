import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createCameraSession, submitImage } from '../api/images'
import { ApiError } from '../api/client'
import UploadDropzone from '../components/UploadDropzone'
import ErrorBanner from '../components/ErrorBanner'
import RiskBadge from '../components/RiskBadge'
import FlagList from '../components/FlagList'
import Icon from '../components/Icon'
import { sanitizeFlagsForSubmitter } from '../lib/sanitizedFlags'

// Matches app/config.py's WORK_TYPE_PROMPTS keys, plus the three
// values that route into the OCR layer (README's Layer 5 — only runs
// when work_type is 'receipt'/'invoice'/'document').
const WORK_TYPES = [
  'road construction',
  'school building',
  'community hall',
  'water facility',
  'drainage',
  'bridge',
  'toilet',
  'hospital',
  'electricity',
  'park',
  'receipt',
  'invoice',
  'document',
]

const OCR_WORK_TYPES = new Set(['receipt', 'invoice', 'document'])

const VERIFICATION_COPY = {
  VERIFIED: {
    title: 'Evidence checks completed',
    message: 'All applicable automated checks ran successfully.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  REQUIRES_REVIEW: {
    title: 'Manual verification required',
    message: 'Automated checks raised one or more findings.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  INSUFFICIENT_EVIDENCE: {
    title: 'Date/photo authenticity could not be verified',
    message: 'Some required evidence or detection layers were unavailable. Do not treat a zero score as proof that the image is genuine.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
}

function emptyForm(defaultDistrict, workId = '') {
  return {
    work_id: workId,
    district: defaultDistrict || '',
    work_type: '',
    state: '',
    mp_name: '',
    sanction_date: '',
    claimed_amount: '',
  }
}

// Best-effort browser geolocation — the module's GPS_DISTRICT_MISMATCH
// check (README) is strongest evidence when this is present, but it's
// optional: many devices/browsers deny it, and submit must still work
// without it.
function captureLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    const timer = setTimeout(() => resolve(null), 6000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { timeout: 5500, maximumAge: 0 },
    )
  })
}

export default function UploadPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedWorkId = searchParams.get('workId') || ''
  const [file, setFile] = useState(null)
  const [form, setForm] = useState(() => emptyForm(user?.district, requestedWorkId))
  const [phase, setPhase] = useState('idle') // idle | submitting | success | error
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const resetForNextUpload = () => {
    setFile(null)
    setForm(emptyForm(user?.district, requestedWorkId))
    setPhase('idle')
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Add a photo before submitting.')
      return
    }
    setError(null)
    setPhase('submitting')

    let sessionToken = null
    try {
      const session = await createCameraSession()
      sessionToken = session.token
    } catch {
      // Optional anti-fraud gate — proceed without it rather than block
      // a legitimate submission on a session-service hiccup.
    }

    const location = await captureLocation()

    try {
      const assessment = await submitImage(
        file,
        {
          work_id: form.work_id,
          district: form.district,
          work_type: form.work_type || undefined,
          state: form.state || undefined,
          mp_name: form.mp_name || undefined,
          sanction_date: form.sanction_date || undefined,
          claimed_amount: form.claimed_amount || undefined,
          captured_latitude: location?.latitude,
          captured_longitude: location?.longitude,
          geolocation_accuracy: location?.accuracy,
          capture_timestamp: new Date().toISOString(),
        },
        sessionToken,
      )
      setResult(assessment)
      setPhase('success')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
      setPhase('error')
    }
  }

  if (phase === 'success' && result) {
    return (
      <div className="min-h-full bg-[#f8fafc]">
        <div className="mb-5">
          <h1 className="text-xl font-bold !text-slate-900">Submitted</h1>
          <p className="text-xs text-gray-500 mt-0.5">Work ID {form.work_id} — here's the automated check. A verification officer will review it next.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 stack" style={{ gap: 16, maxWidth: 640 }}>
          <div className="cluster" style={{ gap: 10 }}>
            <RiskBadge
              level={result.risk_level}
              score={result.risk_score}
              verificationStatus={result.verification_status || 'INSUFFICIENT_EVIDENCE'}
            />
          </div>
          {(() => {
            const status = result.verification_status || 'INSUFFICIENT_EVIDENCE'
            const copy = VERIFICATION_COPY[status] || VERIFICATION_COPY.INSUFFICIENT_EVIDENCE
            return (
              <div className={`rounded-lg border px-3 py-2 text-sm ${copy.className}`} role="status">
                <strong className="block">{copy.title}</strong>
                <span>{copy.message}</span>
              </div>
            )
          })()}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <div>Capture date: {result.capture_date ? new Date(result.capture_date).toLocaleString() : 'Unavailable in the uploaded file'}</div>
              {result.layers_skipped?.length > 0 && <div>Checks unavailable: {result.layers_skipped.join(', ')}</div>}
              <div>
                Project-evidence validity: {result.work_evidence_status || 'UNAVAILABLE'}
                {typeof result.work_evidence_probability === 'number'
                  ? ` (${(result.work_evidence_probability * 100).toFixed(1)}% confidence)`
                  : ''}
              </div>
              {typeof result.screen_probability === 'number' && (
                <div>Screen-capture model: {(result.screen_probability * 100).toFixed(1)}% ({result.screen_model_name || 'ML detector'})</div>
              )}
          </div>
          <p style={{ color: 'var(--color-ink)' }}>{result.recommendation}</p>
          <hr className="divider" style={{ margin: '4px 0' }} />
          <h3>Automated findings</h3>
          <FlagList flags={sanitizeFlagsForSubmitter(result.flags)} />
        </div>

        <div className="cluster" style={{ gap: 12, marginTop: 24 }}>
          <button type="button" className="btn btn-primary" onClick={resetForNextUpload}>
            <Icon name="upload" size={16} />
            Upload another
          </button>
          <Link to="/app/submissions" className="btn btn-secondary">
            View my submissions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#f8fafc]">
      <div className="mb-5">
        <h1 className="text-xl font-bold !text-slate-900">Upload Evidence</h1>
        <p className="text-xs text-gray-500 mt-0.5">Submit a work-completion photo for {form.district || 'your district'}.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="stack" style={{ gap: 20, marginTop: error ? 16 : 0 }}>
        <UploadDropzone file={file} onChange={(f) => setFile(f)} />

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-4" style={{ gap: 16 }}>
          <h3 className="text-sm font-bold !text-slate-900 uppercase tracking-wide mb-4">Work details</h3>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="work_id">
                Work ID *
              </label>
              <input
                id="work_id"
                className="input"
                value={form.work_id}
                onChange={update('work_id')}
                placeholder="MP-PUN-2024-0231"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="district">
                District *
              </label>
              <input id="district" className="input" value={form.district} onChange={update('district')} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="work_type">
                Work type *
              </label>
              <select id="work_type" className="input" value={form.work_type} onChange={update('work_type')} required>
                <option value="">Select a type…</option>
                {WORK_TYPES.map((wt) => (
                  <option key={wt} value={wt}>
                    {wt}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="state">
                State
              </label>
              <input id="state" className="input" value={form.state} onChange={update('state')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="mp_name">
                MP name
              </label>
              <input id="mp_name" className="input" value={form.mp_name} onChange={update('mp_name')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="sanction_date">
                Sanction date{OCR_WORK_TYPES.has(form.work_type) ? ' *' : ''}
              </label>
              <input
                id="sanction_date"
                type="date"
                className="input"
                value={form.sanction_date}
                onChange={update('sanction_date')}
                required={OCR_WORK_TYPES.has(form.work_type)}
              />
              <span className="field-hint">Used to compare the document/photo date. Upload metadata cannot prove a date when the original capture date is missing.</span>
            </div>
            {OCR_WORK_TYPES.has(form.work_type) && (
              <div className="field">
                <label className="field-label" htmlFor="claimed_amount">
                  Claimed amount (₹)
                </label>
                <input
                  id="claimed_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.claimed_amount}
                  onChange={update('claimed_amount')}
                />
                <span className="field-hint">Cross-checked against the amount OCR reads off the document.</span>
              </div>
            )}
          </div>
        </div>

        <div className="cluster" style={{ gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={phase === 'submitting'}>
            {phase === 'submitting' ? 'Submitting…' : 'Submit for review'}
            {phase !== 'submitting' && <Icon name="upload" size={16} />}
          </button>
          <span className="field-hint">
            <Icon name="location" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            We'll attach your device location if you allow it — it strengthens the fraud check.
          </span>
        </div>
      </form>
    </div>
  )
}
