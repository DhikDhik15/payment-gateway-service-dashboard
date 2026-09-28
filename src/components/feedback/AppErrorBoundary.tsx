import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button, Card, CardContent } from '@/components/ui';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  // Do not log error objects: request/response details can contain sensitive
  // provider or credential material. The backend request ID is shown by the
  // API layer when available; this boundary intentionally exposes no raw error.
  public componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally empty; see security note above.
  }

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><Card className="w-full max-w-md"><CardContent className="space-y-4 p-6 text-center"><h1 className="text-lg font-semibold">Something went wrong</h1><p className="text-sm text-muted-foreground">The dashboard could not render this view. Refresh the page or sign in again.</p><Button onClick={() => window.location.reload()}>Refresh dashboard</Button></CardContent></Card></main>;
  }
}
