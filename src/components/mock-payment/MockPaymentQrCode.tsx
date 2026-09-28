import { Component, type ErrorInfo, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Badge } from '@/components/ui';

interface MockPaymentQrCodeProps {
  payload: string;
  disabled?: boolean;
}

interface QrCodeErrorBoundaryProps {
  children: ReactNode;
}

interface QrCodeErrorBoundaryState {
  hasError: boolean;
}

class QrCodeErrorBoundary extends Component<QrCodeErrorBoundaryProps, QrCodeErrorBoundaryState> {
  state: QrCodeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): QrCodeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // The textual payload below remains available even if a QR renderer
    // cannot draw the value. Do not expose renderer details to customers.
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          The QR code could not be displayed. Use the payment reference below.
        </p>
      );
    }
    return this.props.children;
  }
}

/**
 * Renders the exact provider-supplied QRIS payload. This component is for the
 * development mock provider only; it never creates or substitutes a payload.
 */
export function MockPaymentQrCode({ payload, disabled = false }: MockPaymentQrCodeProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-sm font-semibold">{disabled ? 'QRIS payment record' : 'Development QR visualization'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {disabled ? 'This development QR is retained as a record and is no longer payable.' : 'This development QR represents the backend-provided QRIS payload; it cannot complete a real payment.'}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
        <QrCodeErrorBoundary>
          <QRCodeSVG
            value={payload}
            size={208}
            level="M"
            marginSize={2}
            title="Development mock payment QRIS code"
            className={disabled ? 'opacity-50 grayscale' : undefined}
          />
        </QrCodeErrorBoundary>
      </div>
      <Badge variant="warning" className="uppercase tracking-wide">Mock Payment</Badge>
      <div className="w-full max-w-sm rounded-md border border-border bg-muted/30 p-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Reference</p>
        <code className="mt-1 block break-all text-xs text-foreground">{payload}</code>
      </div>
    </div>
  );
}
