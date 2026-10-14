import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../common/ui';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Compass className="h-7 w-7" />}
        title="Page not found"
        description="The page you are looking for doesn't exist or has moved."
        action={
          <Link to="/" className="btn-primary">
            Back to home
          </Link>
        }
      />
    </div>
  );
}
