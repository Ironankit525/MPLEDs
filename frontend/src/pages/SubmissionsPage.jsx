import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpFromLine,
  BadgeCheck,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  ClipboardCheck,
  Clock3,
  CircleDollarSign,
  Download,
  FileText,
  Flag,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { useMySubmissions } from '../hooks/useMySubmissions';
import { request } from '../api/client';

/* ─────────────────────────── HELPERS ────────────────────────────── */

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '₹' + n.toLocaleString('en-IN');
}

function formatShortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusPresentation(status) {
  const styles = {
    REJECTED: ['Action Req.', 'bg-red-100 text-red-700 border border-red-200'],
    SIGNED_OFF: ['Signed Off', 'bg-green-100 text-green-700 border border-green-200'],
    APPROVED: ['Approved', 'bg-green-100 text-green-700 border border-green-200'],
    IN_REVIEW: ['In Review', 'bg-blue-100 text-blue-700 border border-blue-200'],
    PENDING_REVIEW: ['Pending Review', 'bg-yellow-100 text-yellow-700 border border-yellow-200'],
    IN_PROGRESS: ['In Progress', 'bg-blue-100 text-blue-700 border border-blue-200'],
    COMPLETED: ['Completed', 'bg-green-100 text-green-700 border border-green-200'],
    NOT_STARTED: ['Not Started', 'bg-slate-100 text-slate-700 border border-slate-200'],
    ON_HOLD: ['On Hold', 'bg-amber-100 text-amber-700 border border-amber-200'],
  };
  return styles[status] || [status || 'Unknown', 'bg-slate-100 text-slate-700 border border-slate-200'];
}

function riskPresentation(level) {
  const styles = {
    HIGH: ['High', 'bg-red-100 text-red-700 border-red-200'],
    MEDIUM: ['Medium', 'bg-amber-100 text-amber-700 border-amber-200'],
    LOW: ['Low', 'bg-emerald-100 text-emerald-700 border-emerald-200'],
  };
  return styles[level] || ['Not assessed', 'bg-slate-100 text-slate-600 border-slate-200'];
}

async function downloadAuditReport({ kpi, financial, project, works, actions }) {
  const { jsPDF } = await import('jspdf');
  const report = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageHeight = report.internal.pageSize.getHeight();
  let y = 18;
  const write = (text, options = {}) => {
    const { bold = false, size = 10, indent = 0 } = options;
    report.setFont('helvetica', bold ? 'bold' : 'normal');
    report.setFontSize(size);
    const lines = report.splitTextToSize(String(text), 190 - indent);
    if (y + lines.length * 5 > pageHeight - 15) {
      report.addPage();
      y = 18;
    }
    report.text(lines, 10 + indent, y);
    y += lines.length * 5 + 2;
  };

  write('MPLADS Contractor Audit Report', { bold: true, size: 18 });
  write(`Generated: ${new Date().toLocaleString('en-IN')}`, { size: 9 });
  y += 4;
  write('Submission summary', { bold: true, size: 13 });
  write(`Total submissions: ${kpi.totalSubmissions}  |  In review: ${kpi.inReview}  |  Approval rate: ${kpi.approvalRate}%`);
  write(`Action required: ${kpi.actionRequired}  |  Flagged: ${kpi.flaggedCount}  |  Trust rating: ${kpi.trustRating}/100`);
  y += 3;
  write('Financial overview', { bold: true, size: 13 });
  write(`Allocated: ${fmt(financial.totalAllocated)}  |  Utilised: ${fmt(financial.utilisedToDate)}  |  Remaining: ${fmt(financial.remainingBalance)}`);
  write(`Utilisation rate: ${financial.utilisationRate}%  |  Pending disbursement: ${fmt(financial.pendingDisbursement)}`);
  y += 3;
  write('Project progress', { bold: true, size: 13 });
  write(`Assigned: ${project.assigned}  |  Completed: ${project.completed}  |  Ongoing: ${project.ongoing}  |  Overdue: ${project.overdue}`);
  write(`Overall progress: ${project.overallProgress}%`);
  y += 3;
  write('Master works', { bold: true, size: 13 });
  if (works.length === 0) write('No works or submissions are currently available.', { indent: 2 });
  works.forEach((work) => write(`${work.workId} — ${work.status}; spend/budget ${work.spend} / ${work.budget}; deadline ${work.deadline}`, { indent: 2 }));
  y += 3;
  write('Action required', { bold: true, size: 13 });
  if (actions.length === 0) write('No resubmissions are currently required.', { indent: 2 });
  actions.forEach((action) => write(`${action.workId}: ${action.reviewerNote}`, { indent: 2 }));

  report.save(`mplads-audit-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function useContractorDashboard() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [summary, projectList] = await Promise.all([
        request('/api/dashboard/summary'),
        request('/api/projects/mine'),
      ]);
      setError(null);
      setData(summary);
      setProjects(projectList.projects || []);
    } catch (err) {
      setError(err.message || 'Could not load dashboard data.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, projects, error, reload: load };
}

/* ═══════════════════════════ ZONE 1 — KPI BAR ═══════════════════════════ */

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, sub, badge, badgeColor }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} aria-hidden="true" />
        </div>
        {badge ? (
          <span className={`rounded-lg px-2.5 py-1 text-lg font-bold leading-none ${badgeColor}`}>{value}</span>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        )}
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function KpiBar({ kpi, onExport }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <KpiCard icon={FileText} iconBg="bg-blue-50" iconColor="text-blue-600" label="Total Submissions" value={kpi.totalSubmissions} />
      <KpiCard icon={TriangleAlert} iconBg="bg-amber-50" iconColor="text-amber-600" label="Action Required" value={kpi.actionRequired} badge badgeColor="bg-amber-100 text-amber-700" />
      <KpiCard icon={Clock3} iconBg="bg-violet-50" iconColor="text-violet-600" label="In Review" value={kpi.inReview} sub={kpi.inReviewAvgDays != null ? `Avg ${kpi.inReviewAvgDays}d` : null} />
      <KpiCard icon={BadgeCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Approval Rate" value={`${kpi.approvalRate}%`} />
      {/* Quick Action card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Zap className="h-5 w-5 text-blue-600" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Action</p>
        </div>
        <Link
          to="/app/upload"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold !text-white transition-colors hover:bg-blue-700"
        >
          <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden="true" />
          Upload Photo
        </Link>
      </div>

      {/* Row 2 */}
      <KpiCard icon={Flag} iconBg="bg-red-50" iconColor="text-red-600" label="Flagged Count" value={kpi.flaggedCount} badge badgeColor="bg-red-100 text-red-700" />
      <KpiCard icon={Clock3} iconBg="bg-teal-50" iconColor="text-teal-600" label="Turnaround" value={kpi.turnaroundDays != null ? `Avg: ${kpi.turnaroundDays} Days` : '—'} />
      <KpiCard icon={ShieldCheck} iconBg="bg-indigo-50" iconColor="text-indigo-600" label="Trust Rating" value={`${kpi.trustRating}/100`} />

      {/* Export Audit Report */}
      <div className="col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:col-span-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <ClipboardList className="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Export Audit Report</p>
        </div>
        <button type="button" onClick={onExport} className="mt-4 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-slate-50">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download PDF
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════ ZONE 2 — ACTION CENTER ═══════════════════════════ */

function ActionCenter({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white border border-red-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 flex-shrink-0 text-red-500" aria-hidden="true" />
        <span className="text-red-700 font-semibold text-sm">
          ACTION REQUIRED: {items.length} Submissions Need Resubmission
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-4">
            {/* Number badge */}
            <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {item.id}
            </div>
            {/* Work ID & District */}
            <div className="min-w-[130px]">
              <p className="text-xs text-gray-400">Work ID</p>
              <p className="font-bold text-sm text-gray-900">{item.workId}</p>
              <p className="text-xs text-gray-400 mt-1">District</p>
              <p className="text-sm text-gray-700">{item.district}</p>
            </div>
            {/* Status */}
            <div className="min-w-[130px]">
              <p className="text-xs text-gray-400">Status</p>
              <span className="inline-block mt-1 text-xs font-semibold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                {item.status}
              </span>
            </div>
            {/* Operational Status */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">Operational Status</p>
              <p className="text-sm text-gray-800 mt-0.5 italic">{item.operationalStatus}</p>
            </div>
            {/* Reviewer Note */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">Reviewer Note</p>
              <p className="text-sm text-gray-700 mt-0.5 italic">{item.reviewerNote}</p>
            </div>
            {/* Upload button */}
            <div className="flex flex-shrink-0 items-center gap-2">
              {item.submissionId && (
                <Link
                  to={`/app/submissions/${item.submissionId}`}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                >
                  View details
                </Link>
              )}
              <Link
                to={`/app/upload?workId=${item.workId}`}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden="true" />
                Upload Photo
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════ ZONE 3 — FINANCIAL + PROJECT ═══════════════════════════ */

function ProgressBar({ percent, color = 'bg-green-500' }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function FinancialOverview({ fin }) {
  const rows = [
    { label: 'Total Allocated', value: fmt(fin.totalAllocated) },
    { label: 'Utilised To Date', value: fmt(fin.utilisedToDate) },
    { label: 'Remaining Balance', value: fmt(fin.remainingBalance) },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <CircleDollarSign className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-bold !text-blue-700 uppercase tracking-wide">Financial Overview</h3>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{r.label}</span>
            <span className="text-sm font-semibold text-gray-900">{r.value}</span>
          </div>
        ))}
        {/* Utilisation Rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Utilisation Rate</span>
            <span className="text-sm font-bold text-gray-900">{fin.utilisationRate}%</span>
          </div>
          <ProgressBar percent={fin.utilisationRate} color="bg-green-500" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Pending Disb.</span>
          <span className="text-sm font-semibold text-gray-900">{fmt(fin.pendingDisbursement)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Funds On Hold</span>
          <span className="text-sm font-semibold text-gray-900">{fmt(fin.fundsOnHold)}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectProgress({ proj }) {
  const rows = [
    { label: 'Projects Assigned', value: proj.assigned },
    { label: 'Projects Completed', value: proj.completed },
    { label: 'Projects Ongoing', value: proj.ongoing },
    { label: 'Projects Not Started', value: proj.notStarted },
    { label: 'Overdue Projects', value: proj.overdue },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <ChartNoAxesCombined className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-bold !text-indigo-700 uppercase tracking-wide">Project Progress &amp; Milestones</h3>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{r.label}</span>
            <span className="text-sm font-bold text-gray-900">{r.value}</span>
          </div>
        ))}
        {/* Overall Progress */}
        <div>
          <div className="flex items-center gap-4 mb-1">
            <span className="text-sm text-gray-600">Overall Progress</span>
            <span className="text-sm font-bold text-gray-900">{proj.overallProgress}%</span>
          </div>
          <ProgressBar percent={proj.overallProgress} color="bg-indigo-500" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ ZONE 4 — MASTER WORKS TABLE ═══════════════════════════ */

function WorksTable({ works }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const statusOptions = ['All', ...new Set(works.map((work) => work.status))];

  const riskRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const filtered = works
    .filter((w) => {
      const query = search.toLowerCase();
      const matchSearch = w.workId.toLowerCase().includes(query) || w.district?.toLowerCase().includes(query);
      const matchStatus = filterStatus === 'All' || w.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const priorityDifference = (riskRank[a.riskLevel] ?? 3) - (riskRank[b.riskLevel] ?? 3);
      if (priorityDifference !== 0) return priorityDifference;
      return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
    });

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
        {/* Table Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h3 className="text-sm font-bold !text-blue-700 uppercase tracking-wide">Master Works Table</h3>
          </div>
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search Work ID or District..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5  text-black text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
              />
            </div>
            {/* Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className=" text-black text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {statusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
            <span className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700">High-risk first</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Work ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Risk</th>
                <th className="px-4 py-3 text-left">Spend/Budget</th>
                <th className="px-4 py-3 text-left">Phase Tracker</th>
                <th className="px-4 py-3 text-left">Target Deadline</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => (
                <tr key={w.workId} className={w.riskLevel === 'HIGH' ? 'bg-red-50/40 transition-colors hover:bg-red-50' : 'transition-colors hover:bg-slate-50'}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{w.workId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${w.statusColor}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const [label, className] = riskPresentation(w.riskLevel);
                      return <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {w.spend} / {w.budget}
                  </td>
                  <td className="px-4 py-3 w-40">
                    <p className="text-xs text-gray-600 mb-1">{w.phaseTracker.label}</p>
                    <ProgressBar percent={w.phaseTracker.percent} color={w.phaseTracker.color} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{w.deadline}</td>
                  <td className="px-4 py-3">
                    {w.submissionId ? (
                      <Link
                        to={`/app/submissions/${w.submissionId}`}
                        className="inline-flex border border-slate-300 hover:bg-slate-100 !text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View Submission
                      </Link>
                    ) : (
                      <span className="text-xs !text-gray-400">No submission</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No matching work orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}

/* ═══════════════════════════ ACTIVITY + CHECKLIST ═══════════════════════════ */

function ActivityFeed({ items }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h3 className="text-xs font-bold !text-gray-700 uppercase tracking-wide">Recent Activity Feed</h3>
      </div>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-2.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${a.color}`} />
            <div>
              <p className="text-xs text-gray-800 leading-snug">{a.text}</p>
              <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocumentChecklist({ items }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h3 className="text-xs font-bold !text-gray-700 uppercase tracking-wide">Document Checklist</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <ChecklistIcon type={item.type} />
            <p className="text-xs text-gray-700 leading-snug">{item.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistIcon({ type }) {
  const iconClass = 'mt-0.5 h-4 w-4 flex-shrink-0';
  if (type === 'action') return <CircleAlert className={`${iconClass} text-red-500`} aria-hidden="true" />;
  if (type === 'complete') return <CircleCheck className={`${iconClass} text-emerald-600`} aria-hidden="true" />;
  return <Clock3 className={`${iconClass} text-amber-600`} aria-hidden="true" />;
}

/* ═══════════════════════════ TOP HEADER BAR ═══════════════════════════ */

function TopHeader() {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold !text-gray-900">Contractor Operational View</h1>
      <p className="text-xs text-gray-500 mt-0.5">
        Track submissions, monitor progress and ensure timely execution of works
      </p>
    </div>
  );
}


/* ═══════════════════════════ PAGE ROOT ═══════════════════════════ */

export default function SubmissionsPage() {
  const { submissions, loading: submissionsLoading, error: submissionsError, reload } = useMySubmissions();
  const { data: dashboard, projects, error: dashboardError, reload: reloadDashboard } = useContractorDashboard();
  const submitted = submissions || [];
  const financials = dashboard?.financials;
  const byStatus = dashboard?.submissions_by_status || {};
  const localReviewCount = submitted.filter((item) => ['PENDING_REVIEW', 'IN_REVIEW'].includes(item.status)).length;
  const kpi = {
    totalSubmissions: dashboard?.total_submissions ?? submitted.length,
    actionRequired: dashboard?.action_required_count ?? submitted.filter((item) => item.status === 'REJECTED').length,
    inReview: dashboard ? (byStatus.PENDING_REVIEW || 0) + (byStatus.IN_REVIEW || 0) : localReviewCount,
    inReviewAvgDays: null,
    approvalRate: dashboard?.approval_rate ?? 0,
    flaggedCount: dashboard?.flagged_submissions ?? submitted.filter((item) => ['MEDIUM', 'HIGH'].includes(item.risk_level)).length,
    turnaroundDays: null,
    trustRating: dashboard?.average_risk_score == null ? '—' : Math.max(0, Math.round(100 - dashboard.average_risk_score)),
  };
  const financial = {
    totalAllocated: financials?.sanctioned_amount,
    utilisedToDate: financials?.amount_utilised,
    remainingBalance: financials?.amount_remaining,
    utilisationRate: financials?.utilisation_percent ?? 0,
    pendingDisbursement: financials?.amount_pending_disbursement,
    fundsOnHold: financials?.amount_awaiting_decision,
  };
  const project = {
    assigned: dashboard?.projects_assigned ?? projects.length,
    completed: dashboard?.projects_completed ?? 0,
    ongoing: dashboard?.projects_in_progress ?? 0,
    notStarted: dashboard?.projects_not_started ?? 0,
    overdue: dashboard?.projects_overdue ?? 0,
    overallProgress: dashboard?.overall_progress_percent ?? 0,
  };
  const submissionsByWork = new Map();
  submitted.forEach((item) => {
    const current = submissionsByWork.get(item.work_id);
    if (!current || new Date(item.uploaded_at || 0) > new Date(current.uploaded_at || 0)) {
      submissionsByWork.set(item.work_id, item);
    }
  });
  const worksById = new Map(projects.map((item) => [item.work_id, item]));
  const works = projects.map((item) => {
    const latestSubmission = submissionsByWork.get(item.work_id);
    const [status, statusColor] = statusPresentation(latestSubmission?.status || item.status);
    return {
      workId: item.work_id,
      district: item.district,
      status,
      statusColor,
      spend: fmt(item.financials?.amount_utilised),
      budget: fmt(item.financials?.sanctioned_amount),
      phaseTracker: { label: `${Math.round(item.progress_percent || 0)}% complete`, percent: item.progress_percent || 0, color: item.is_overdue ? 'bg-red-500' : 'bg-blue-500' },
      deadline: item.expected_completion_date ? formatShortDate(item.expected_completion_date) : 'Not set',
      submissionId: latestSubmission?.id,
      riskLevel: latestSubmission?.risk_level,
      uploadedAt: latestSubmission?.uploaded_at,
    };
  });
  // A newly uploaded submission can exist before an administrator creates or
  // assigns its Project record. Keep those submissions visible in the master
  // table instead of making the upload appear to disappear.
  submissionsByWork.forEach((submission, workId) => {
    if (worksById.has(workId)) return;
    const [status, statusColor] = statusPresentation(submission.status);
    works.push({
      workId,
      district: submission.district,
      status,
      statusColor,
      spend: '—',
      budget: '—',
      phaseTracker: { label: 'Evidence submitted', percent: 0, color: 'bg-blue-500' },
      deadline: 'Not set',
      submissionId: submission.id,
      riskLevel: submission.risk_level,
      uploadedAt: submission.uploaded_at,
    });
  });
  const actions = (dashboard?.action_required || submitted.filter((item) => item.status === 'REJECTED')).map((item, index) => {
    const submission = item.image_id ? submitted.find((record) => record.id === item.image_id) : item;
    return {
      id: item.image_id || item.id || index + 1,
      workId: item.work_id,
      district: submission?.district || '—',
      status: 'Resubmission Requested',
      operationalStatus: submission?.flags?.[0]?.human_message || 'Reviewer action is required',
      reviewerNote: item.reason || submission?.reviewer_notes || 'Please review the feedback and submit updated evidence.',
      submissionId: item.image_id || submission?.id,
    };
  });
  const activity = submitted.slice(0, 4).map((item) => ({
    id: item.id,
    color: item.status === 'REJECTED'
      ? 'bg-red-500'
      : item.status === 'PENDING_REVIEW'
        ? 'bg-amber-500'
        : item.status === 'IN_REVIEW'
          ? 'bg-blue-500'
          : 'bg-emerald-500',
    text: `${item.work_id} is ${statusPresentation(item.status)[0].toLowerCase()}`,
    time: formatShortDate(item.reviewed_at || item.uploaded_at),
  }));
  const checklist = [
    ...actions.map((item) => ({ id: `action-${item.id}`, type: 'action', text: `${item.workId}: resubmission required` })),
    ...submitted
      .filter((item) => item.status !== 'REJECTED')
      .slice(0, Math.max(0, 4 - actions.length))
      .map((item) => ({
        id: `submission-${item.id}`,
        type: item.status === 'SIGNED_OFF' ? 'complete' : 'pending',
        text: `${item.work_id}: ${statusPresentation(item.status)[0]}`,
      })),
  ];
  if (checklist.length === 0) checklist.push({ id: 'clear', type: 'complete', text: 'No evidence has been uploaded yet.' });

  return (
    <div className="bg-[#f8fafc] min-h-screen p-5">
      {/* Top header */}
      <TopHeader />

      {(submissionsError || dashboardError) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submissionsError || dashboardError}
          <button type="button" onClick={() => { reload(); reloadDashboard(); }} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      {submissionsLoading && !submissions && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading submissions…</div>
      )}

      {/* Zone 1 — KPI Bar */}
      <KpiBar
        kpi={kpi}
        onExport={() => downloadAuditReport({ kpi, financial, project, works, actions })}
      />

      {/* Zone 2 — Action Center */}
      <ActionCenter items={actions} />

      {/* Zone 3 — Financial + Project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <FinancialOverview fin={financial} />
        <ProjectProgress proj={project} />
      </div>

      {/* Zone 4 — Master Works Table */}
      <WorksTable works={works} />

      {/* Activity + Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActivityFeed items={activity} />
        <DocumentChecklist items={checklist} />
      </div>
    </div>
  );
}
