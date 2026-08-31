import React from 'react';
import { Card } from '../../../components/common/Card.jsx';
import { ProjectCard } from '../../../components/project/ProjectCard.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const RecentProjects = ({ projects = [] }) => {
  const navigate = useNavigate();

  return (
    <Card
      title="Recent Constituency Projects"
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} icon={ArrowRight}>
          View All
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.slice(0, 3).map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </Card>
  );
};
