import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Flag,
  FileText,
  User,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  PlusCircle,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  Building,
  DollarSign,
  Briefcase,
  AlertCircle,
  Info,
} from 'lucide-react'

import CircularGauge from '../components/charts/CircularGauge'
import DonutChart from '../components/charts/DonutChart'
import FundFlowChart from '../components/charts/FundFlowChart'
import ExpenditureTrendChart from '../components/charts/ExpenditureTrendChart'
import ProjectMap from '../components/map/ProjectMap'
import FieldEvidenceModal from '../components/modals/FieldEvidenceModal'
import FlagProjectModal from '../components/modals/FlagProjectModal'
import UpdateProgressModal from '../components/modals/UpdateProgressModal'
import PhotoLightboxModal from '../components/modals/PhotoLightboxModal'

export default function ProjectDetailsDashboardPage() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('Overview')

  // Modals state
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false)
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [progressModalOpen, setProgressModalOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  // Project dynamic metrics
  const [projectData, setProjectData] = useState({
    id: id || 'MP/BR/205/412',
    name: 'Community Hall Construction',
    status: 'Delayed',
    mpName: 'Shri Rajiv Pratap Rudy',
    constituency: 'Saran, Bihar',
    agency: 'Rural Development Dept.',
    sector: 'Community Infrastructure',
    subType: 'Community Building',
    sanctionDate: '15 Nov 2024',
    adminApprovalDate: '10 Nov 2024',
    techApprovalDate: '12 Nov 2024',
    startDate: '01 Jan 2025',
    expectedCompletion: '30 Jun 2026',
    revisedCompletion: '30 Aug 2026',
    delayDays: 61,
    longitude: 84.741,
    latitude: 25.275,
    locationAddress: 'Village: Sonpur, Block: Sonpur, District: Saran, Bihar - 841101',
    sanctionedAmount: 3800000,
    releasedAmount: 3400000,
    expenditure: 3116000,
    unutilized: 684000,
    pendingBills: 215000,
    physicalProgress: 43,
    financialProgress: 82,
    aiRiskScore: 93,
    aiRiskLevel: 'Critical Risk',
  })

  // Format INR Currency
  const formatINR = (val) => {
    return '₹ ' + Number(val).toLocaleString('en-IN')
  }

  // Tabs list
  const tabs = [
    'Overview',
    'Financials',
    'Progress & Timeline',
    'AI Risk Analysis',
    'Location & Map',
    'Photos & Evidence',
    'Documents',
    'Audit Trail',
  ]

  // Real Construction Site Photos (Clean realistic assets)
  const photos = [
    {
      id: 1,
      date: '02 May 2025',
      src: '/images/site_photo_1.svg',
      caption: 'Roof slab framework and column reinforcement',
    },
    {
      id: 2,
      date: '18 Apr 2025',
      src: '/images/site_photo_2.svg',
      caption: 'Brick masonry and lintel casting work',
    },
    {
      id: 3,
      date: '05 Apr 2025',
      src: '/images/site_photo_3.svg',
      caption: 'Plinth level column raising and foundation',
    },
    {
      id: 4,
      date: '20 Mar 2025',
      src: '/images/site_photo_4.svg',
      caption: 'Interior hall column structural inspection',
    },
  ]

  // Documents list
  const documents = [
    { name: 'Administrative Approval.pdf', date: '12 Nov 2024', size: '245 KB' },
    { name: 'Technical Sanction Order.pdf', date: '12 Nov 2024', size: '320 KB' },
    { name: 'Detailed Project Report.pdf', date: '10 Nov 2024', size: '1.2 MB' },
    { name: 'Utilization Certificate.pdf', date: '15 Feb 2025', size: '180 KB' },
    { name: 'Measurement Book.pdf', date: 'Updated 25 Apr 2025', size: '530 KB' },
  ]

  // Nearby Projects
  const nearbyProjects = [
    { name: 'Rural Road Construction', dist: '1.2 km' },
    { name: 'Water Supply Scheme', dist: '2.4 km' },
    { name: 'School Building', dist: '3.1 km' },
    { name: 'Drainage System Improvement', dist: '3.7 km' },
    { name: 'Anganwadi Center', dist: '4.0 km' },
  ]

  // Donut Segments for Project Status
  const projectStatusSegments = [
    { label: 'Completed', value: 78456, color: '#10B981', percent: '63.1%' },
    { label: 'In Progress', value: 32145, color: '#2563EB', percent: '25.8%' },
    { label: 'Sanctioned', value: 7890, color: '#F59E0B', percent: '6.3%' },
    { label: 'Delayed', value: 8765, color: '#EF4444', percent: '7.0%' },
    { label: 'Not Started', value: 3327, color: '#94A3B8', percent: '2.7%' },
  ]

  // Donut Segments for Financial Summary
  const financialSegments = [
    { label: 'Expenditure', value: 3116000, color: '#10B981', percent: '82%' },
    { label: 'Unutilized', value: 684000, color: '#F59E0B', percent: '18%' },
  ]

  return (
    <div className="project-detail-page">
      {/* ── Subheader / Project Title & Actions Bar ── */}
      <div className="project-subheader-card">
        <div className="subheader-main-row">
          <div className="subheader-title-group">
            <div className="title-badge-row">
              <h1 className="project-heading">{projectData.name}</h1>
              <span className="status-pill status-delayed">{projectData.status}</span>
            </div>
            {/* Metadata Badges line */}
            <div className="project-metadata-line">
              <span className="meta-item">
                <FileText size={13} className="meta-icon" />
                Project ID: <strong>{projectData.id}</strong>
              </span>
              <span className="meta-sep">|</span>
              <span className="meta-item">
                <User size={13} className="meta-icon" />
                MP: <strong>{projectData.mpName}</strong>
              </span>
              <span className="meta-sep">|</span>
              <span className="meta-item">
                Constituency: <strong>{projectData.constituency}</strong>
              </span>
              <span className="meta-sep">|</span>
              <span className="meta-item">
                Implementing Agency: <strong>{projectData.agency}</strong>
              </span>
              <span className="meta-sep">|</span>
              <span className="meta-item">
                Sector: <strong>{projectData.sector}</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="subheader-actions-group">
            <Link to="/app/projects" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} />
              Back to Projects
            </Link>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => alert('Exporting comprehensive project audit report...')}
            >
              <Download size={14} />
              Download Report
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setFlagModalOpen(true)}
            >
              <Flag size={14} />
              Flag Project
            </button>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="project-tabs-nav" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`project-tab-btn ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── 7 KPI Metric Cards Row ── */}
      <div className="kpi-cards-grid">
        {/* KPI 1: Sanctioned Amount */}
        <div className="kpi-card">
          <div className="kpi-label">Sanctioned Amount</div>
          <div className="kpi-value-row">
            <span className="kpi-main-val">{formatINR(projectData.sanctionedAmount)}</span>
          </div>
        </div>

        {/* KPI 2: Released Amount */}
        <div className="kpi-card">
          <div className="kpi-label">Released Amount</div>
          <div className="kpi-value-row">
            <span className="kpi-icon-pill green-pill">
              <DollarSign size={13} />
            </span>
            <span className="kpi-main-val">{formatINR(projectData.releasedAmount)}</span>
          </div>
        </div>

        {/* KPI 3: Expenditure */}
        <div className="kpi-card">
          <div className="kpi-label">Expenditure</div>
          <div className="kpi-value-row">
            <span className="kpi-icon-pill blue-pill">
              <Briefcase size={13} />
            </span>
            <span className="kpi-main-val">{formatINR(projectData.expenditure)}</span>
          </div>
        </div>

        {/* KPI 4: Utilization */}
        <div className="kpi-card">
          <div className="kpi-label">Utilization</div>
          <div className="kpi-value-row">
            <span className="mini-progress-ring">
              <svg width="22" height="22" viewBox="0 0 22 22">
                <circle cx="11" cy="11" r="8" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeDasharray="50.2"
                  strokeDashoffset="9.0"
                  transform="rotate(-90 11 11)"
                />
              </svg>
            </span>
            <span className="kpi-main-val">{projectData.financialProgress}.0%</span>
          </div>
        </div>

        {/* KPI 5: Physical Progress */}
        <div className="kpi-card">
          <div className="kpi-label">Physical Progress</div>
          <div className="kpi-value-row">
            <span className="kpi-main-val">{projectData.physicalProgress}%</span>
          </div>
          <div className="kpi-progress-bar-wrap">
            <div
              className="kpi-progress-bar-fill"
              style={{ width: `${projectData.physicalProgress}%` }}
            ></div>
          </div>
        </div>

        {/* KPI 6: Expected Completion */}
        <div className="kpi-card">
          <div className="kpi-label">Expected Completion</div>
          <div className="kpi-value-row">
            <span className="kpi-main-val">{projectData.expectedCompletion}</span>
          </div>
        </div>

        {/* KPI 7: Actual / Revised Completion / Delay */}
        <div className="kpi-card kpi-card-delay">
          <div className="kpi-label">Actual / Revised Completion</div>
          <div className="kpi-value-row kpi-delay-row">
            <span className="kpi-main-val">-- / {projectData.revisedCompletion}</span>
            <span className="kpi-delay-badge">{projectData.delayDays} Days</span>
          </div>
        </div>
      </div>

      {/* ── Content Grid Section ── */}
      <div className="dashboard-content-flow">
        {/* ══ ROW 1: Project Info | Location Map | Project Status | AI Risk Score ══ */}
        <div className="dashboard-grid-4col">
          {/* Card 1.1: Project Information */}
          <div className="dash-card">
            <h3 className="card-heading">Project Information</h3>
            <div className="info-kv-list">
              <div className="info-kv-row">
                <span className="info-key">Project Type</span>
                <span className="info-val">{projectData.sector}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Sub Type</span>
                <span className="info-val">{projectData.subType}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Sanction Date</span>
                <span className="info-val">{projectData.sanctionDate}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Administrative Approval</span>
                <span className="info-val">{projectData.adminApprovalDate}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Technical Approval</span>
                <span className="info-val">{projectData.techApprovalDate}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Start Date</span>
                <span className="info-val">{projectData.startDate}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Longitude</span>
                <span className="info-val">{projectData.longitude.toFixed(4)}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-key">Latitude</span>
                <span className="info-val">{projectData.latitude.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Card 1.2: Location (Map) */}
          <div className="dash-card card-location-map">
            <h3 className="card-heading">Location</h3>
            <p className="location-subtitle-text">{projectData.locationAddress}</p>
            <div className="map-view-box">
              <ProjectMap
                latitude={projectData.latitude}
                longitude={projectData.longitude}
                projectName={projectData.name}
                locationDetails={projectData.locationAddress}
              />
            </div>
          </div>

          {/* Card 1.3: Project Status */}
          <div className="dash-card card-project-status">
            <h3 className="card-heading">Project Status</h3>
            <div className="donut-and-legend-layout">
              {/* Legend */}
              <div className="status-legend-list">
                {projectStatusSegments.map((item) => (
                  <div key={item.label} className="legend-row-item">
                    <span className="legend-color-dot" style={{ backgroundColor: item.color }} />
                    <span className="legend-label">{item.label}</span>
                    <strong className="legend-value">
                      {item.value.toLocaleString()} ({item.percent})
                    </strong>
                  </div>
                ))}
              </div>

              {/* Donut */}
              <div className="donut-chart-container">
                <DonutChart
                  segments={projectStatusSegments}
                  size={140}
                  strokeWidth={20}
                  centerValue={`${projectData.physicalProgress}%`}
                  centerLabel="Overall Progress"
                />
              </div>
            </div>
          </div>

          {/* Card 1.4: AI Risk Score */}
          <div className="dash-card card-ai-risk">
            <div className="card-header-flex">
              <h3 className="card-heading">AI Risk Score</h3>
              <span className="risk-level-badge badge-high-risk">High Risk</span>
            </div>

            <div className="risk-gauge-center-wrap">
              <CircularGauge
                value={projectData.aiRiskScore}
                max={100}
                size={130}
                strokeWidth={10}
                variant="risk"
                label={projectData.aiRiskLevel}
                sublabel="/100"
              />
            </div>

            {/* Risk Factors Breakdown */}
            <div className="risk-factors-breakdown">
              <div className="risk-factor-row">
                <span className="factor-name">Cost Overrun</span>
                <div className="factor-bar-wrap">
                  <div className="factor-bar-fill fill-blue" style={{ width: '38%' }} />
                </div>
                <span className="factor-pct">38%</span>
              </div>

              <div className="risk-factor-row">
                <span className="factor-name">Delay in Progress</span>
                <div className="factor-bar-wrap">
                  <div className="factor-bar-fill fill-blue" style={{ width: '28%' }} />
                </div>
                <span className="factor-pct">28%</span>
              </div>

              <div className="risk-factor-row">
                <span className="factor-name">Payment-Progress Mismatch</span>
                <div className="factor-bar-wrap">
                  <div className="factor-bar-fill fill-blue" style={{ width: '15%' }} />
                </div>
                <span className="factor-pct">15%</span>
              </div>

              <div className="risk-factor-row">
                <span className="factor-name">Location Anomaly</span>
                <div className="factor-bar-wrap">
                  <div className="factor-bar-fill fill-blue" style={{ width: '10%' }} />
                </div>
                <span className="factor-pct">10%</span>
              </div>

              <div className="risk-factor-row">
                <span className="factor-name">Other Factors</span>
                <div className="factor-bar-wrap">
                  <div className="factor-bar-fill fill-blue" style={{ width: '9%' }} />
                </div>
                <span className="factor-pct">9%</span>
              </div>
            </div>

            <div className="card-bottom-link-row">
              <button
                type="button"
                className="text-link-btn"
                onClick={() => setEvidenceModalOpen(true)}
              >
                View AI Risk Analysis <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ══ ROW 2: Financial Summary | Fund Flow | Expenditure Trend | Quick Actions ══ */}
        <div className="dashboard-grid-4col">
          {/* Card 2.1: Financial Summary (₹) */}
          <div className="dash-card card-financial-summary">
            <h3 className="card-heading">Financial Summary (₹)</h3>
            <div className="financial-donut-wrap">
              <DonutChart
                segments={financialSegments}
                size={140}
                strokeWidth={22}
                centerValue={`${projectData.financialProgress}%`}
                centerLabel="Utilized"
              />
            </div>
            <div className="financial-legend-list">
              <div className="fin-legend-item">
                <span className="legend-color-dot dot-blue" />
                <span className="fin-label">Sanctioned</span>
                <strong className="fin-val">{formatINR(projectData.sanctionedAmount)} (100%)</strong>
              </div>
              <div className="fin-legend-item">
                <span className="legend-color-dot dot-green" />
                <span className="fin-label">Expenditure</span>
                <strong className="fin-val">{formatINR(projectData.expenditure)} (82%)</strong>
              </div>
              <div className="fin-legend-item">
                <span className="legend-color-dot dot-amber" />
                <span className="fin-label">Unutilized</span>
                <strong className="fin-val">{formatINR(projectData.unutilized)} (18%)</strong>
              </div>
            </div>
          </div>

          {/* Card 2.2: Fund Flow */}
          <div className="dash-card card-fund-flow">
            <h3 className="card-heading">Fund Flow</h3>
            <FundFlowChart
              allocated={formatINR(projectData.sanctionedAmount)}
              released={formatINR(projectData.releasedAmount)}
              expenditure={formatINR(projectData.expenditure)}
              unutilized={formatINR(projectData.unutilized)}
              pendingBills={formatINR(projectData.pendingBills)}
            />
          </div>

          {/* Card 2.3: Expenditure Trend (₹) */}
          <div className="dash-card card-expenditure-trend">
            <h3 className="card-heading">Expenditure Trend (₹)</h3>
            <ExpenditureTrendChart />
          </div>

          {/* Card 2.4: Quick Actions & Nearby Projects */}
          <div className="dash-card card-quick-actions-nearby">
            <h3 className="card-heading">Quick Actions</h3>
            <div className="quick-actions-grid">
              <button
                type="button"
                className="action-tile-btn"
                onClick={() => setEvidenceModalOpen(true)}
              >
                <PlusCircle size={15} className="tile-icon blue-icon" />
                <span>Add Field Evidence</span>
              </button>

              <button
                type="button"
                className="action-tile-btn"
                onClick={() => setProgressModalOpen(true)}
              >
                <TrendingUp size={15} className="tile-icon green-icon" />
                <span>Update Progress</span>
              </button>

              <button
                type="button"
                className="action-tile-btn"
                onClick={() => setFlagModalOpen(true)}
              >
                <AlertTriangle size={15} className="tile-icon red-icon" />
                <span>Raise Issue</span>
              </button>

              <button
                type="button"
                className="action-tile-btn"
                onClick={() => alert('Inspection request submitted for Saran District nodal officer.')}
              >
                <Search size={15} className="tile-icon purple-icon" />
                <span>Request Inspection</span>
              </button>
            </div>

            {/* Nearby Projects */}
            <div className="nearby-projects-section">
              <div className="nearby-header-row">
                <h4 className="nearby-heading">Nearby Projects (5)</h4>
                <Link to="/app/projects" className="view-all-link">
                  View All
                </Link>
              </div>
              <div className="nearby-list">
                {nearbyProjects.map((p) => (
                  <div key={p.name} className="nearby-item-row">
                    <span className="nearby-name">{p.name}</span>
                    <span className="nearby-dist">{p.dist}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══ ROW 3: Progress & Timeline | Recent Photos | Documents ══ */}
        <div className="dashboard-grid-3col">
          {/* Card 3.1: Progress & Timeline */}
          <div className="dash-card card-progress-timeline">
            <h3 className="card-heading">Progress &amp; Timeline</h3>
            <div className="timeline-bars-section">
              <div className="timeline-bar-group">
                <div className="bar-label-row">
                  <span>Physical Progress</span>
                  <strong>{projectData.physicalProgress}%</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill fill-blue"
                    style={{ width: `${projectData.physicalProgress}%` }}
                  />
                </div>
              </div>

              <div className="timeline-bar-group">
                <div className="bar-label-row">
                  <span>Financial Progress</span>
                  <strong>{projectData.financialProgress}%</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill fill-green"
                    style={{ width: `${projectData.financialProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="timeline-milestones-list">
              <div className="milestone-row">
                <span className="milestone-label">Start Date</span>
                <span className="milestone-val">{projectData.startDate}</span>
              </div>
              <div className="milestone-row">
                <span className="milestone-label">Original Completion</span>
                <span className="milestone-val">{projectData.expectedCompletion}</span>
              </div>
              <div className="milestone-row">
                <span className="milestone-label">Revised Completion</span>
                <span className="milestone-val">{projectData.revisedCompletion}</span>
              </div>
              <div className="milestone-row">
                <span className="milestone-label">Delay</span>
                <span className="milestone-val text-red">
                  <strong>{projectData.delayDays} Days</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 3.2: Recent Photos (Field Evidence) */}
          <div className="dash-card card-recent-photos">
            <div className="card-header-flex">
              <h3 className="card-heading">Recent Photos (Field Evidence)</h3>
              <button
                type="button"
                className="view-all-link"
                onClick={() => setEvidenceModalOpen(true)}
              >
                View All
              </button>
            </div>

            <div className="photos-gallery-grid">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="photo-thumb-card"
                  onClick={() => setSelectedPhoto(p)}
                >
                  <div className="photo-img-wrap">
                    <img src={p.src} alt={p.caption} className="photo-thumb-img" />
                  </div>
                  <span className="photo-date-tag">{p.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3.3: Documents */}
          <div className="dash-card card-documents">
            <div className="card-header-flex">
              <h3 className="card-heading">Documents</h3>
            </div>

            <div className="documents-list">
              {documents.map((doc, idx) => (
                <div key={idx} className="document-item-row">
                  <div className="doc-icon-wrap">
                    <FileText size={18} className="doc-pdf-icon" />
                  </div>
                  <div className="doc-info-col">
                    <span className="doc-name">{doc.name}</span>
                    <span className="doc-meta">
                      {doc.date} &bull; {doc.size}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="doc-download-btn"
                    aria-label={`Download ${doc.name}`}
                    onClick={() => alert(`Downloading ${doc.name}...`)}
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="card-bottom-link-row center-link">
              <button
                type="button"
                className="view-all-docs-btn"
                onClick={() => alert('Displaying all 14 project sanction and measurement documents.')}
              >
                View All Documents
              </button>
            </div>
          </div>
        </div>

        {/* ══ ROW 4: AI Insights Bottom Banner ══ */}
        <div className="ai-insights-banner-card">
          <div className="banner-title-row">
            <div className="banner-badge-title">
              <ShieldAlert size={18} className="banner-badge-icon" />
              <h3 className="banner-heading">AI Insights</h3>
            </div>

            <button
              type="button"
              className="view-detailed-insights-btn"
              onClick={() => alert('Opening AI Diagnostic & Anomaly Breakdown for Saran District...')}
            >
              View Detailed AI Insights <ChevronRight size={14} />
            </button>
          </div>

          <div className="insights-cards-row">
            <div className="insight-item-box warning-box">
              <div className="insight-icon-pill red-pill">
                <AlertTriangle size={15} />
              </div>
              <p className="insight-text">
                Cost overrun risk detected due to slow progress compared to expenditure.
              </p>
            </div>

            <div className="insight-item-box schedule-box">
              <div className="insight-icon-pill amber-pill">
                <Clock size={15} />
              </div>
              <p className="insight-text">
                Recommend regular monitoring of field progress and timely fund utilization.
              </p>
            </div>

            <div className="insight-item-box info-box">
              <div className="insight-icon-pill blue-pill">
                <Info size={15} />
              </div>
              <p className="insight-text">
                Similar projects in this district show 15% higher delay rate. Please review.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <FieldEvidenceModal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        workId={projectData.id}
        onUploaded={(newAssessment) => {
          alert('Field photograph uploaded and assessed by AI Pipeline successfully!')
        }}
      />

      <FlagProjectModal
        isOpen={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        projectName={projectData.name}
      />

      <UpdateProgressModal
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        currentPhysical={projectData.physicalProgress}
        currentExpenditure={projectData.expenditure}
        onUpdate={(updated) => {
          setProjectData((prev) => ({
            ...prev,
            physicalProgress: updated.physicalProgress,
            expenditure: updated.expenditure,
          }))
        }}
      />

      <PhotoLightboxModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </div>
  )
}
