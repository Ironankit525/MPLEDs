import React, { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { PageHeader } from '../../components/layout/PageHeader';
import { ProjectFilters } from '../../components/project/ProjectFilters';
import { ProjectCard } from '../../components/project/ProjectCard';
import { ProjectTable } from '../../components/project/ProjectTable';
import { Button } from '../../components/common/Button';
import { Loader } from '../../components/common/Loader';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Projects = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({ search: '', sector: '', status: '' });

  const { projects, loading, error, refresh } = useProjects(filters);

  return (
    <div>
      <PageHeader
        title="MPLADS Constituency Projects"
        description="Monitor, track, and manage all sanctioned works and development projects."
        action={
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button icon={Plus} onClick={() => navigate('/mp/projects/new')}>
              Propose New Project
            </Button>
          </div>
        }
      />

      <ProjectFilters filters={filters} onChange={setFilters} />

      {loading && <Loader label="Filtering Projects..." />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          title="No Matching Projects"
          description="Try clearing search text or adjusting status/sector filters."
        />
      )}

      {!loading && !error && projects.length > 0 && (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <ProjectTable projects={projects} />
        )
      )}
    </div>
  );
};
