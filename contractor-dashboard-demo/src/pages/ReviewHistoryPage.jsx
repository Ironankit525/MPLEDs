import { Link } from 'react-router-dom'
import { useRecordList } from '../hooks/useRecordList.js'
import { getReviewHistory } from '../api/reviews.js'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import Spinner from '../components/Spinner.jsx'
import Icon from '../components/Icon.jsx'
import { isRemoteUrl, formatDate } from '../lib/format.js'

export default function ReviewHistoryPage() {
  const { items, loading, error, reload } = useRecordList(getReviewHistory, 'Could not load reviewed submissions.')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reviewed</h1>
          <p>Submissions with a final decision, most recent first.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !items && <Spinner label="Loading history…" />}

      {items && items.length === 0 && (
        <EmptyState icon="history" title="No decisions yet" description="Submissions you approve or reject will show up here." />
      )}

      {items && items.length > 0 && (
        <ul className="submission-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/contractor/review/${item.id}`} className="card submission-card">
                {isRemoteUrl(item.file_path) ? (
                  <img src={item.file_path} alt="" className="submission-thumb" />
                ) : (
                  <div className="submission-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                    <Icon name="image" size={20} />
                  </div>
                )}
                <div className="submission-info">
                  <div className="work-id">{item.work_id}</div>
                  <div className="meta">
                    {item.district} · decided by {item.reviewed_by_username || 'unknown'} ·{' '}
                    {formatDate(item.reviewed_at, { dateStyle: 'medium' })}
                  </div>
                </div>
                <div className="submission-badges">
                  <RiskBadge level={item.risk_level} />
                  <StatusBadge status={item.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
