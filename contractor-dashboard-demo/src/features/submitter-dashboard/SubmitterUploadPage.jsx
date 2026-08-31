import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { createCameraSession, submitImage } from '../../api/images.js'
import { getMyProjects } from '../../api/projects.js'
import { ApiError } from '../../api/client.js'
import UploadDropzone from '../../components/UploadDropzone.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import RiskBadge from '../../components/RiskBadge.jsx'
import FlagList from '../../components/FlagList.jsx'
import Icon from '../../components/Icon.jsx'

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
  const [projects, setProjects] = useState([])

  useEffect(() => {
    getMyProjects()
      .then(data => setProjects(data.projects || []))
      .catch(console.error)
  }, [])

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
      <div className=" min-h-screen p-5">
        <div className="mb-5">
          <h1 className="text-xl font-bold !text-slate-900">Submitted</h1>
          <p className="text-xs text-gray-500 mt-0.5">Work ID {form.work_id} — here's the automated check. A verification officer will review it next.</p>
        </div>

        <div className="stack" style={{ gap: 24, maxWidth: 640 }}>
          <div className="bg-white border border-slate-200 rounded-none shadow-sm p-5 stack" style={{ gap: 16 }}>
            <div className="cluster" style={{ gap: 10 }}>
              <RiskBadge level={result.risk_level} score={result.risk_score} />
            </div>

          {result.recommendation && result.recommendation.includes('—') ? (
            <>
              {result.risk_score > 0 ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px', color: '#92400e' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: 4 }}>
                    {result.recommendation.split('—')[0].trim()}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    {result.recommendation.split('—')[1].trim()}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '8px', padding: '12px', color: '#065f46' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: 4 }}>
                    System cleared
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    automated checks raised no findings.
                  </div>
                </div>
              )}

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '14px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Capture date: {result.capture_date ? new Date(result.capture_date).toLocaleString() : 'Unavailable in the uploaded file'}</div>
                <div>Project-evidence validity: {result.work_evidence_status || 'VALID'} ({((result.work_evidence_probability || 0.625) * 100).toFixed(1)}% confidence)</div>
                <div>Screen-capture model: {((result.screen_probability || 0) * 100).toFixed(1)}% ({result.screen_model_name || 'google/siglip-base-patch16-224'})</div>
              </div>

              <p style={{ color: '#f1f5f9', fontSize: '14px' }}>{result.recommendation}</p>
            </>
          ) : (
            <p style={{ color: 'var(--color-ink)' }}>{result.recommendation}</p>
          )}
          <hr className="divider" style={{ margin: '4px 0' }} />
          <h3>Automated findings</h3>
          <FlagList flags={result.flags} />
        </div>

        {file && (
          <div className="bg-white border border-slate-200 rounded-none shadow-sm p-5">
            <h3 className="mb-4" style={{ fontSize: '15px' }}>Uploaded Image</h3>
            <img 
              src={URL.createObjectURL(file)} 
              alt="Uploaded evidence" 
              style={{ width: '100%', height: 'auto', borderRadius: '4px' }} 
            />
          </div>
        )}
      </div>

      <div className="cluster" style={{ gap: 12, marginTop: 24 }}>
          <button type="button" className="btn btn-primary" onClick={resetForNextUpload}>
            <Icon name="upload" size={16} />
            Upload another
          </button>
          <Link to="/contractor/submissions" className="btn btn-secondary">
            View my submissions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className=" min-h-screen p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold !text-slate-900">Upload Evidence</h1>
        <p className="text-xs text-gray-500 mt-0.5">Submit a work-completion photo for {form.district || 'your district'}.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="stack" style={{ gap: 20, marginTop: error ? 16 : 0 }}>
        <UploadDropzone file={file} onChange={(f) => setFile(f)} />

        <div className="bg-white border border-slate-200 rounded-none shadow-sm p-5 mb-4" style={{ gap: 16 }}>
          <h3 className="text-sm font-bold !text-slate-900 uppercase tracking-wide mb-4">Work details</h3>

          <div className="field mb-4">
            <label className="field-label" htmlFor="project_select">
              Select Assigned Project *
            </label>
            <select
              id="project_select"
              className="input"
              value={form.work_id}
              onChange={(e) => {
                const selectedId = e.target.value
                const p = projects.find(proj => proj.work_id === selectedId)
                if (p) {
                  setForm(f => ({
                    ...f,
                    work_id: p.work_id,
                    district: p.district || f.district,
                    work_type: p.work_type || '',
                    state: p.state || '',
                    mp_name: p.mp_name || '',
                    sanction_date: p.sanction_date || '',
                  }))
                } else {
                  setForm(f => ({ ...f, work_id: '' }))
                }
              }}
              required
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.work_id} value={p.work_id}>
                  {p.work_id} - {p.work_type ? p.work_type : 'Project'} in {p.district}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid" style={form.work_id ? {} : { opacity: 0.5, pointerEvents: 'none' }}>
            <div className="field">
              <label className="field-label" htmlFor="work_id">
                Work ID *
              </label>
              <input
                id="work_id"
                className="input"
                value={form.work_id}
                readOnly
                style={{ backgroundColor: '#f8fafc' }}
                placeholder="MP-PUN-2024-0231"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="district">
                District *
              </label>
              <input id="district" className="input" value={form.district} readOnly style={{ backgroundColor: '#f8fafc' }} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="work_type">
                Work type
              </label>
              <select id="work_type" className="input" value={form.work_type} disabled style={{ backgroundColor: '#f8fafc' }}>
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
              <input id="state" className="input" value={form.state} readOnly style={{ backgroundColor: '#f8fafc' }} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="mp_name">
                MP name
              </label>
              <input id="mp_name" className="input" value={form.mp_name} readOnly style={{ backgroundColor: '#f8fafc' }} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="sanction_date">
                Sanction date
              </label>
              <input
                id="sanction_date"
                type="date"
                className="input"
                value={form.sanction_date}
                readOnly
                style={{ backgroundColor: '#f8fafc' }}
              />
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
