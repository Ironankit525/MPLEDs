import React, { useState } from 'react'
import { X, TrendingUp, CheckCircle } from 'lucide-react'

export default function UpdateProgressModal({
  isOpen,
  onClose,
  currentPhysical = 43,
  currentExpenditure = 3116000,
  onUpdate,
}) {
  const [physicalProgress, setPhysicalProgress] = useState(currentPhysical)
  const [expenditure, setExpenditure] = useState(currentExpenditure)
  const [milestone, setMilestone] = useState('Roof Slab Casting & Masonry')
  const [remarks, setRemarks] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleUpdate = (e) => {
    e.preventDefault()
    setSubmitted(true)
    if (onUpdate) {
      onUpdate({ physicalProgress, expenditure, milestone, remarks })
    }
    setTimeout(() => {
      setSubmitted(false)
      onClose()
    }, 1200)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <TrendingUp size={20} className="modal-title-icon blue-icon" />
            <h2 className="modal-title">Update Project Physical &amp; Financial Progress</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="modal-body modal-success-body">
            <CheckCircle size={48} className="success-icon" />
            <h3>Progress Updated</h3>
            <p>Milestone progress and expenditure successfully updated in database records.</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  Physical Progress Percentage: <strong>{physicalProgress}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={physicalProgress}
                  onChange={(e) => setPhysicalProgress(Number(e.target.value))}
                  className="form-range-slider"
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label">Total Expenditure to Date (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={expenditure}
                    onChange={(e) => setExpenditure(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current Stage / Milestone</label>
                  <select
                    className="form-input"
                    value={milestone}
                    onChange={(e) => setMilestone(e.target.value)}
                  >
                    <option value="Foundation Work">Foundation &amp; Substructure</option>
                    <option value="Column & Plinth Beam">Column &amp; Plinth Beam</option>
                    <option value="Roof Slab Casting & Masonry">Roof Slab Casting &amp; Masonry</option>
                    <option value="Plastering & Electrical">Plastering &amp; Electrical</option>
                    <option value="Flooring & Finishing">Flooring &amp; Finishing</option>
                    <option value="Final Handover">Final Handover &amp; Completion</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Measurement Book (MB) Reference &amp; Remarks</label>
                <textarea
                  className="form-input form-textarea"
                  rows={3}
                  placeholder="E.g., MB Book 42 Page 18, inspection conducted by Junior Engineer..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Progress Update
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
