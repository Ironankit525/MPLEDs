import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react';
import { projectService } from './projectService.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { ProjectTimeline } from '../../components/project/ProjectTimeline.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { ErrorState } from '../../components/common/ErrorState.jsx';
import { Button } from '../../components/common/Button.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { MapPin, ArrowLeft, Building2, Users } from 'lucide-react';

export const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await projectService.getProjectById(id);
        setProject(data);
      } catch (err) {
        setError(err.message || 'Project details could not be found.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) return <Loader label="Retrieving Project Dossier..." />;
  if (error) return <ErrorState message={error} onRetry={() => navigate('/projects')} />;
  if (!project) return null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/projects')}>
        Back to Projects
      </Button>

      <PageHeader
        title={project.name}
        description={`Project ID: ${project.id} | Sector: ${project.sector}`}
        action={<Badge variant="indigo">{project.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Financial Sanctions & Utilization">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg">
                <span className="text-xs text-slate-500 font-semibold block">Sanctioned Amount</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(project.sanctionedAmount)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg">
                <span className="text-xs text-slate-500 font-semibold block">Released Amount</span>
                <span className="text-lg font-bold text-sky-700">{formatCurrency(project.releasedAmount)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg">
                <span className="text-xs text-slate-500 font-semibold block">Utilized Amount</span>
                <span className="text-lg font-bold text-emerald-700">{formatCurrency(project.utilizedAmount)}</span>
              </div>
            </div>
          </Card>

          <Card title="Project Location & Geographic Coordinates">
            <div className="flex items-center gap-3 text-slate-700">
              <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">
                  {project.location?.village}, {project.location?.district}, {project.location?.state}
                </p>
                <p className="text-xs text-slate-500">
                  Lat: {project.location?.latitude}° N | Long: {project.location?.longitude}° E
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Timeline & Metadata */}
        <div className="space-y-6">
          <Card title="Execution Milestones">
            <ProjectTimeline
              startDate={project.startDate}
              expectedCompletionDate={project.expectedCompletionDate}
              completionPercentage={project.completionPercentage}
            />
          </Card>

          <Card title="Contractor & Beneficiary Impact">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span className="text-slate-700 font-semibold">Contractor ID: {project.contractorId || 'CON001'}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700 font-semibold">Target Beneficiaries: {project.beneficiaries?.toLocaleString()} citizens</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
