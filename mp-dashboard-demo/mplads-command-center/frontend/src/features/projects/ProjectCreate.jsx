import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { SECTORS } from '../../constants/sectors.js';
import { ArrowLeft, Save } from 'lucide-react';

export const ProjectCreate = () => {
  const navigate = useNavigate();
  const { createProject } = useProjects();

  const [formData, setFormData] = useState({
    name: '',
    sector: SECTORS[0],
    village: '',
    district: '',
    sanctionedAmount: '',
    expectedCompletionDate: '',
    beneficiaries: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sanctionedAmount) {
      setError('Project name and sanctioned amount are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProject({
        name: formData.name,
        sector: formData.sector,
        location: {
          village: formData.village || 'Demo Village',
          district: formData.district || 'Demo District',
          state: 'Maharashtra',
          latitude: 18.5204,
          longitude: 73.8567
        },
        sanctionedAmount: Number(formData.sanctionedAmount),
        expectedCompletionDate: formData.expectedCompletionDate || '2026-12-31',
        beneficiaries: Number(formData.beneficiaries || 1000)
      });
      navigate('/mp/projects');
    } catch (err) {
      setError(err.message || 'Failed to register project proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/mp/projects')}>
        Back to Projects
      </Button>

      <PageHeader
        title="Propose New MPLADS Development Work"
        description="Register a new sanctioned project proposal into the constituency pipeline."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Primary Health Centre Solar Installation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Development Sector *</label>
              <select
                value={formData.sector}
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition cursor-pointer"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sanctioned Amount (INR) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 2500000"
                value={formData.sanctionedAmount}
                onChange={(e) => setFormData({ ...formData, sanctionedAmount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gram Panchayat / Village</label>
              <input
                type="text"
                placeholder="e.g. Haveli Block"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Completion Date</label>
              <input
                type="date"
                value={formData.expectedCompletionDate}
                onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => navigate('/mp/projects')}>Cancel</Button>
            <Button type="submit" disabled={submitting} icon={Save}>
              {submitting ? 'Registering...' : 'Save & Register Work'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
