import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Button, Card, CardContent, EmptyState } from '@/components/ui';

/**
 * Full-screen recovery state for a failed initial session restore (network
 * outage, timeout, 5xx). A failed restore is never proof the session is
 * invalid, so this replaces the login bounce: the user retries explicitly
 * (no automatic retry loop) or continues to sign-in. Renders before any
 * merchant data can load, so nothing sensitive can leak across boundaries.
 */
export function RestoreErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <EmptyState
            title="Connection unavailable"
            description="We could not reach the server to restore your session. Your sign-in may still be valid — check your connection and try again."
            icon={<WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          />
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="ghost" asChild>
              <Link to="/login">Continue to sign-in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
