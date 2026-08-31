import { Link } from 'react-router-dom'
import { useMySubmissions } from '../hooks/useMySubmissions.js'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import Spinner from '../components/Spinner.jsx'
import Icon from '../components/Icon.jsx'
import { isRemoteUrl, formatDate } from '../lib/format.js'

export default function SubmissionsPage() {
  const { submissions, loading, error, reload } = useMySubmissions()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Submissions</h1>
          <p>Every photo you've submitted, and where it stands in review.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && !submissions && <Spinner label="Loading your submissions…" />}

      {submissions && submissions.length === 0 && (
        <EmptyState
          icon="inbox"
          title="No submissions yet"
          description="Photos you upload will show up here with their review status."
          action={
            <Link to="/app/upload" className="btn btn-primary">
              <Icon name="upload" size={16} />
              Upload your first photo
            </Link>
          }
        />
      )}

      {submissions && submissions.length > 0 && (
        <ul className="submission-list">
          {submissions.map((s) => (
            <li key={s.id}>
              <Link to={`/app/submissions/${s.id}`} className="card submission-card">
                {isRemoteUrl(s.file_path) ? (
                  <img src={s.file_path} alt="" className="submission-thumb" />
                ) : (
                  <div className="submission-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                    <Icon name="image" size={20} />
                  </div>
                )}
                <div className="submission-info">
                  <div className="work-id">{s.work_id}</div>
                  <div className="meta">
                    {s.work_type || 'Uncategorised'} · {s.district} · {formatDate(s.uploaded_at, { dateStyle: 'medium' })}
                  </div>
                </div>
                <div className="submission-badges">
                  <RiskBadge level={s.risk_level} />
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
