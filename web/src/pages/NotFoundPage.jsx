import { Link } from 'react-router';
import { Button } from '../components/ui/button.jsx';

export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild className="mt-6">
        <Link to="/">Back to companies</Link>
      </Button>
    </div>
  );
}
