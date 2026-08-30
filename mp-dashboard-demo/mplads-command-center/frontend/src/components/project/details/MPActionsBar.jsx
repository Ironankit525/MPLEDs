import React, { useState } from 'react';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { 
  Send, 
  FileSearch, 
  Camera, 
  Building2, 
  AlertOctagon, 
  CheckCircle2, 
  HelpCircle, 
  X, 
  ShieldAlert,
  ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MPActionsBar = ({ project }) => {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null); // 'clarification' | 'inspection' | 'escalate' | null
  const [note, setNote] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState(null);

  if (!project) return null;

  const handleActionSubmit = (actionType) => {
    let msg = '';
    if (actionType === 'clarification') {
      msg = `Clarification notice formally dispatched to District Authority for Project "${project.title}".`;
    } else if (actionType === 'inspection') {
      msg = `Special Field Inspection requisition registered with State Quality Monitor for Project "${project.title}".`;
    } else if (actionType === 'escalate') {
      msg = `Project delay escalation submitted to District Collectorate and Ministry Dashboard for Project "${project.title}".`;
    }

    setSubmittedMessage(msg);
    setActiveModal(null);
    setNote('');

    setTimeout(() => {
      setSubmittedMessage(null);
    }, 5000);
  };

  return (
    <>
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide">Parliamentary Oversight & MP Direct Actions</h3>
              <p className="text-[11px] text-slate-400">Initiate statutory inquiries, mandate technical inspections, or escalate milestones directly from command telemetry.</p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            MP Authority Level: Active
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveModal('clarification')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Request Clarification</span>
          </button>

          <button
            onClick={() => setActiveModal('inspection')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileSearch className="w-3.5 h-3.5 text-slate-400" />
            <span>Mandate Field Inspection</span>
          </button>

          <button
            onClick={() => setActiveModal('escalate')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            <span>Escalate Delay / Mismatch</span>
          </button>

          {project.contractor?.id && (
            <button
              onClick={() => navigate(`/contractors/${project.contractor.id}`)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Inspect Contractor Profile</span>
            </button>
          )}
        </div>

        {/* Feedback Success Notification */}
        {submittedMessage && (
          <div className="p-3 bg-emerald-950/90 border border-emerald-700 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{submittedMessage}</span>
          </div>
        )}
      </div>

      {/* ACTION MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                {activeModal === 'clarification' && <><HelpCircle className="w-5 h-5 text-slate-700" /> Request Statutory Clarification</>}
                {activeModal === 'inspection' && <><FileSearch className="w-5 h-5 text-slate-700" /> Mandate Field Quality Inspection</>}
                {activeModal === 'escalate' && <><AlertOctagon className="w-5 h-5 text-rose-600" /> Escalate Milestone Delay</>}
              </h4>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-500 font-semibold block">Target Project:</span>
                <strong className="text-slate-900 text-sm block">{project.title}</strong>
                <span className="text-slate-500 font-mono text-[11px]">ID: {project.id} • Implementing Agency: {project.contractor?.name || 'District PWD'}</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  {activeModal === 'clarification' && 'Specific clarification points / queries:'}
                  {activeModal === 'inspection' && 'Terms of reference for inspection team:'}
                  {activeModal === 'escalate' && 'Escalation rationale & remedial timeline demands:'}
                </label>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Enter details, reference observations, or special instructions..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleActionSubmit(activeModal)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Parliamentary Action</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
