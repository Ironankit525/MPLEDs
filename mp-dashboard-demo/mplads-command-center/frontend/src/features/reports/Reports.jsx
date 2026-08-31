import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useUser } from '../../hooks/useUser.js';
import { reportService } from './reportService.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { FileSpreadsheet, Download, FileText } from 'lucide-react';

export const Reports = () => {
  const { currentMP } = useAuth();
  const { financialYear } = useUser();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      if (!currentMP?.id) return;
      setLoading(true);
      try {
        const data = await reportService.getAvailableReports(currentMP.id, financialYear);
        setReports(data);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [currentMP?.id, financialYear]);

  if (loading) return <Loader label="Generating Audit Reports..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="MPLADS Official Audit & Telemetry Reports"
        description="Download compliance reports, financial statements, and physical progress audits."
      />

      <div className="space-y-4">
        {reports.map((rep) => (
          <Card key={rep.id} className="flex items-center justify-between gap-4 p-4 hover:border-slate-300 transition duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{rep.title}</h4>
                <span className="text-xs text-slate-500 font-medium">Category: {rep.category} • Format: {rep.format}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => alert(`Downloading ${rep.title} in demo environment.`)}
            >
              Export {rep.format}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
