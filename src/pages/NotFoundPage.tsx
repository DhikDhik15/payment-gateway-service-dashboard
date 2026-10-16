import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button, Card, CardContent, EmptyState } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle } from '@/lib/documentTitle';

/**
 * Catch-all for unknown URLs. Never redirects implicitly: it explains the
 * situation and offers one safe action. The target resolves from auth state
 * (dashboard for signed-in users, login otherwise, homepage while loading —
 * the root redirect then settles the destination, so no loop is possible).
 * No internal route or server details are exposed.
 */
export function NotFoundPage() {
  const { isAuthenticated, isLoading } = useAuth();
  useDocumentTitle('Page not found');

  const target = isLoading ? '/' : isAuthenticated ? '/dashboard' : '/login';
  const label = isLoading ? 'Go to homepage' : isAuthenticated ? 'Back to dashboard' : 'Go to login';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <EmptyState
            title="Page not found"
            description="The page you are looking for does not exist or is not available to your account."
            icon={<FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          />
          <div className="mt-4 flex justify-center">
            <Button asChild>
              <Link to={target}>{label}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
