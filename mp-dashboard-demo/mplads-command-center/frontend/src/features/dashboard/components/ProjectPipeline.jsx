import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card.jsx';
import { ChevronRight, FileSpreadsheet, ShieldCheck, CheckCircle2, PlayCircle, Award, ArrowUpRight } from 'lucide-react';

export const ProjectPipeline = ({ pipeline = [] }) => {
  const navigate = useNavigate();

  const stageIcons = {
    Proposed: FileSpreadsheet,
    'Technically Approved': ShieldCheck,
    Sanctioned: CheckCircle2,
    Started: PlayCircle,
    Completed: Award
  };

  return (
    <Card
      title="Project Lifecycle Pipeline"
      subtitle="Track bottleneck stages from constituent proposal to ground commissioning"
      action={
        <button
          onClick={() => navigate('/mp/projects')}
          className="text-xs font-bold text-black hover:text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <span>View All Projects</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {pipeline.map((stage, idx) => {
          const Icon = stageIcons[stage.stage] || FileSpreadsheet;
          const isCompleted = stage.stage === 'Completed';
          const isStarted = stage.stage === 'Started';

          return (
            <div
              key={idx}
              onClick={() => navigate('/mp/projects')}
              className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                isCompleted
                  ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                  : isStarted
                  ? 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-300'
                  : 'bg-slate-50 border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Step 0{idx + 1}
                  </span>
                  <div className={`p-1.5 rounded-lg border ${
                    isCompleted
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                      : isStarted
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl font-extrabold font-display text-slate-900">
                  {stage.count}
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  {stage.stage}
                </div>
              </div>

              <div className="pt-2.5 mt-2.5 border-t border-slate-200/70">
                <span className="text-[11px] font-medium text-slate-500 line-clamp-1 block">
                  {stage.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
