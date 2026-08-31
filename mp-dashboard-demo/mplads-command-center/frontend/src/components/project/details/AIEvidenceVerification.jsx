import React, { useState } from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { 
  Sparkles, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Maximize2, 
  X, 
  ArrowRight, 
  ShieldCheck, 
  SlidersHorizontal,
  Check,
  Layers,
  ChevronRight
} from 'lucide-react';

const STATUS_BADGE_MAP = {
  VERIFIED: { variant: 'emerald', label: '🟢 AI Verified', icon: CheckCircle2 },
  AI_ANALYZED: { variant: 'indigo', label: '🔵 AI Analyzed', icon: Sparkles },
  REQUIRES_REVIEW: { variant: 'amber', label: '🟡 Requires Review', icon: AlertTriangle },
  MISMATCH_DETECTED: { variant: 'rose', label: '🔴 Mismatch Detected', icon: AlertTriangle },
  PENDING: { variant: 'slate', label: '⚪ Pending Analysis', icon: Clock },
};

export const AIEvidenceVerification = ({ 
  evidence = [], 
  milestoneTracks = [], 
  beforeAfter = null 
}) => {
  // Default to 50% milestone (M50) or first available with photos
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('M50');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  // Filter evidence photos matching current selected milestone
  const milestonePhotos = evidence.filter(e => e.milestoneId === selectedMilestoneId);
  const currentPhotoList = milestonePhotos.length > 0 ? milestonePhotos : evidence;
  const activeEvidence = currentPhotoList[selectedImageIndex] || currentPhotoList[0] || evidence[0];

  if (!evidence || evidence.length === 0) {
    return (
      <Card title="Site Progress & Evidence">
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
          <Camera className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Site Evidence Uploaded Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Contractor site photos and computer vision interpretations will appear here as work progresses.
          </p>
        </div>
      </Card>
    );
  }

  const ai = activeEvidence?.aiAnalysis || {};
  const statusConfig = STATUS_BADGE_MAP[activeEvidence?.verificationStatus] || STATUS_BADGE_MAP.VERIFIED;
  const consistency = ai.consistency || { status: 'CONSISTENT', difference: 2, explanation: 'AI vision progress estimate is consistent with contractor reported milestone.' };

  const reportedVal = ai.contractorReported ?? 53;
  const estimatedVal = ai.estimatedProgress ?? 51;
  const diffVal = Math.abs(reportedVal - estimatedVal);

  return (
    <div className="space-y-4">
      {/* Section Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Evidence Engine
            </span>
            <h2 className="text-lg font-black text-slate-900">
              Site Progress & Evidence
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Contractor-submitted milestone images validated by AI computer vision models.
          </p>
        </div>
      </div>

      {/* Placeholder / Temporary Standby State */}
      <Card>
        <div className="p-8 text-center bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-800">
              Site Progress & AI Evidence Module
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Milestone photo journey, AI computer vision telemetry, and before/after verification models are configured and will be enabled for this project.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Milestone Evidence Processing On Standby</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
