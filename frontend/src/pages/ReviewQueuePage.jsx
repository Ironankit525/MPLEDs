import { Link } from 'react-router-dom'
import { useRecordList } from '../hooks/useRecordList'
import { getReviewQueue } from '../api/reviews'
import RiskBadge from '../components/RiskBadge'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import { formatDate } from '../lib/format'

export default function ReviewQueuePage() {
  const { items, loading, error, reload } = useRecordList(getReviewQueue, 'Could not load the review queue.')

  const pending = items?.filter((i) => i.status === 'PENDING_REVIEW') || []
  const inReview = items?.filter((i) => i.status === 'IN_REVIEW') || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Review Queue</h1>
          <p>Submissions awaiting a decision, highest automated risk first.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !items && <Spinner label="Loading the queue…" />}

      {items && items.length === 0 && (
        <EmptyState icon="shield" title="Queue is empty" description="Nothing is waiting for review right now." />
      )}

      {items && items.length > 0 && (
        <div className="kanban">
          <div>
            <div className="kanban-column-header">
              <Icon name="clock" size={14} />
              Pending Review
              <span className="kanban-count">{pending.length}</span>
            </div>
            {pending.length === 0 && (
              <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Nothing unclaimed.</p>
            )}
            {pending.map((item) => (
              <QueueCard key={item.id} item={item} />
            ))}
          </div>

          <div>
            <div className="kanban-column-header">
              <Icon name="inbox" size={14} />
              In Review
              <span className="kanban-count">{inReview.length}</span>
            </div>
            {inReview.length === 0 && <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Nothing claimed.</p>}
            {inReview.map((item) => (
              <QueueCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QueueCard({ item }) {
  return (
    <Link to={`/app/review/${item.id}`} className="card kanban-card">
      <div className="work-id">{item.work_id}</div>
      <div className="meta">
        {item.work_type || 'Uncategorised'} · {item.district} · {formatDate(item.uploaded_at, { dateStyle: 'medium' })}
      </div>
      <div className="meta">Submitted by {item.submitted_by_username || 'unknown'}</div>
      <div className="badges">
        <RiskBadge level={item.risk_level} score={item.risk_score} />
      </div>
      {item.status === 'IN_REVIEW' && (
        <div className="claimed-by">
          <Icon name="inbox" size={12} />
          Claimed by {item.reviewed_by_username || 'a reviewer'}
        </div>
      )}
    </Link>
  )
}
