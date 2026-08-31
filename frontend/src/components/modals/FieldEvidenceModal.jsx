import React, { useState, useRef } from 'react'
import {
  X,
  UploadCloud,
  Camera,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { API_BASE_URL, getToken } from '../../api/client'

const MAX_SIZE_BYTES = 4 * 1024 * 1024

export default function FieldEvidenceModal({ isOpen, onClose, onUploaded, workId = 'MP/BR/205/412' }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [workType, setWorkType] = useState('community hall')
  const [district, setDistrict] = useState('Saran')
  const [state, setState] = useState('Bihar')
  const [claimedAmount, setClaimedAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [assessment, setAssessment] = useState(null)
  const [error, setError] = useState(null)
  const [isDryRun, setIsDryRun] = useState(false)

  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > MAX_SIZE_BYTES) {
      setError('The image is over the 4 MB upload limit. Choose a smaller photo.')
      e.target.value = ''
      return
    }
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setAssessment(null)
    setError(null)
  }

  const handleSubmit = async (dryRun = false) => {
    if (!file) {
      setError('Please select or capture a photograph to upload.')
      return
    }

    setLoading(true)
    setError(null)
    setIsDryRun(dryRun)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('work_id', workId)
      formData.append('work_type', workType)
      formData.append('district', district)
      formData.append('state', state)
      if (claimedAmount) formData.append('claimed_amount', claimedAmount)

      const endpoint = dryRun ? '/api/images/check' : '/api/images/submit'
      const token = getToken()

      const headers = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Upload failed')
      }

      setAssessment(data)
      if (!dryRun && onUploaded) {
        onUploaded(data)
      }
    } catch (err) {
      setError(err.message || 'An error occurred during image assessment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Camera size={20} className="modal-title-icon" />
            <h2 className="modal-title">Upload Field Evidence (AI Verification)</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-grid-2col">
            {/* Left: Upload Dropzone & Metadata */}
            <div className="modal-col">
              <div
                className={`modal-dropzone ${file ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden-file-input"
                  onChange={handleFileChange}
                />
                {previewUrl ? (
                  <div className="dropzone-preview-wrap">
                    <img src={previewUrl} alt="Preview" className="dropzone-img-preview" />
                    <span className="change-photo-badge">Click to change photo</span>
                  </div>
                ) : (
                  <div className="dropzone-placeholder">
                    <UploadCloud size={36} className="dropzone-icon" />
                    <span className="dropzone-text">Click or drag &amp; drop field photo</span>
                    <span className="dropzone-sub">JPG, PNG, WebP up to 4MB</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Work ID</label>
                <input type="text" className="form-input" value={workId} readOnly />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label">District</label>
                  <input
                    type="text"
                    className="form-input"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Type</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Right: Real-time AI Fraud Check Output */}
            <div className="modal-col">
              <h3 className="sub-heading">Multi-Layer AI Verification Pipeline</h3>
              <p className="sub-desc">
                Your photograph will be scanned across perceptual hashing, duplicate detection, CLIP
                semantic content verification, EXIF validation, and ELA tamper detection.
              </p>

              {assessment ? (
                <div className="assessment-results-box">
                  <div className="assessment-header-badge-row">
                    <span className={`risk-pill risk-${assessment.risk_level.toLowerCase()}`}>
                      {assessment.risk_level} RISK ({assessment.risk_score}/100)
                    </span>
                    <span className="processing-time-text">
                      {assessment.processing_time_ms} ms
                    </span>
                  </div>

                  <p className="recommendation-text">
                    <strong>Recommendation:</strong> {assessment.recommendation}
                  </p>

                  <div className="assessment-flags-list">
                    <strong className="flags-title">Findings ({assessment.flags?.length || 0})</strong>
                    {assessment.flags?.length === 0 ? (
                      <div className="no-flags-pass">
                        <CheckCircle size={15} className="pass-icon" />
                        <span>No anomalies or duplicates detected. Genuine photo evidence.</span>
                      </div>
                    ) : (
                      assessment.flags.map((flg, idx) => (
                        <div key={idx} className={`flag-item-card severity-${flg.severity?.toLowerCase()}`}>
                          <div className="flag-code-row">
                            <span className="flag-code">{flg.code}</span>
                            <span className="flag-points">+{flg.points_added} pts</span>
                          </div>
                          <p className="flag-message">{flg.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="pipeline-layers-preview">
                  <div className="layer-preview-item">
                    <ShieldCheck size={16} className="layer-icon green" />
                    <span>Layer 1: Cryptographic Hash &amp; Perceptual Hash (dHash/pHash)</span>
                  </div>
                  <div className="layer-preview-item">
                    <ShieldCheck size={16} className="layer-icon blue" />
                    <span>Layer 2: CLIP Semantic Angle &amp; Work-type Alignment</span>
                  </div>
                  <div className="layer-preview-item">
                    <ShieldCheck size={16} className="layer-icon amber" />
                    <span>Layer 3: Geolocation Coordinates &amp; EXIF Chronology</span>
                  </div>
                  <div className="layer-preview-item">
                    <ShieldCheck size={16} className="layer-icon purple" />
                    <span>Layer 4: Error Level Analysis (ELA) &amp; Screenshot Detection</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!file || loading}
            onClick={() => handleSubmit(true)}
          >
            {loading && isDryRun ? <Loader2 size={16} className="animate-spin" /> : 'Dry Run Check'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!file || loading}
            onClick={() => handleSubmit(false)}
          >
            {loading && !isDryRun ? <Loader2 size={16} className="animate-spin" /> : 'Submit Evidence'}
          </button>
        </div>
      </div>
    </div>
  )
}
