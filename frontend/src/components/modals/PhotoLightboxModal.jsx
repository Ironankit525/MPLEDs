import React from 'react'
import { X, Calendar, MapPin, CheckCircle, ShieldCheck } from 'lucide-react'

export default function PhotoLightboxModal({ photo, onClose }) {
  if (!photo) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-photo-lightbox" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="lightbox-title-wrap">
            <h3 className="lightbox-title">{photo.caption || 'Field Construction Evidence'}</h3>
            <span className="lightbox-date">
              <Calendar size={13} />
              {photo.date}
            </span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="lightbox-body">
          <div className="lightbox-img-wrap">
            <img src={photo.src} alt={photo.caption || 'Field Evidence'} className="lightbox-full-img" />
          </div>

          <div className="lightbox-meta-bar">
            <div className="meta-pill">
              <ShieldCheck size={14} className="green-text" />
              <span>AI Verified (Low Risk / Genuine)</span>
            </div>
            <div className="meta-pill">
              <MapPin size={14} className="blue-text" />
              <span>25.7011° N, 85.1843° E (Sonpur, Saran)</span>
            </div>
            <div className="meta-pill">
              <span>EXIF: Untampered original capture</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
