import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'

export default function NotFoundPage() {
  return (
    <div className="auth-page">
      <EmptyState
        icon="x-circle"
        title="Page not found"
        description="That page doesn't exist."
        action={
          <Link to="/" className="btn btn-primary">
            Go home
          </Link>
        }
      />
    </div>
  )
}
