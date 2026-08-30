import React, { useState } from 'react'
import { X, Flag, AlertTriangle, CheckCircle } from 'lucide-react'

export default function FlagProjectModal({ isOpen, onClose, projectName = 'Community Hall Construction' }) {
  const [category, setCategory] = useState('Cost Overrun')
  const [severity, setSeverity] = useState('High')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleFlagSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      onClose()
    }, 1500)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Flag size={20} className="modal-title-icon red-icon" />
            <h2 className="modal-title">Flag Project / Raise Issue</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="modal-body modal-success-body">
            <CheckCircle size={48} className="success-icon" />
            <h3>Project Flagged Successfully</h3>
            <p>Alert has been broadcast to the Nodal Verification Officer and District Authority.</p>
          </div>
        ) : (
          <form onSubmit={handleFlagSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input type="text" className="form-input" value={projectName} readOnly />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label">Issue Category</label>
                  <select
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Cost Overrun">Cost Overrun vs Physical Progress</option>
                    <option value="Timeline Delay">Significant Delay in Execution</option>
                    <option value="Duplicate Evidence">Suspected Duplicate Photo Evidence</option>
                    <option value="Location Discrepancy">GPS Geotag Mismatch</option>
                    <option value="Quality Concerns">Material / Construction Quality Concern</option>
                    <option value="Unutilized Funds">Fund Utilization Stagnation</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Severity Level</label>
                  <select
                    className="form-input"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="High">High (Immediate Review)</option>
                    <option value="Medium">Medium (Scheduled Audit)</option>
                    <option value="Low">Low (Informational Observation)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Observations / Reason</label>
                <textarea
                  className="form-input form-textarea"
                  rows={4}
                  placeholder="Provide specific notes regarding why this project is being flagged..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger">
                <Flag size={15} />
                Submit Flag
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
