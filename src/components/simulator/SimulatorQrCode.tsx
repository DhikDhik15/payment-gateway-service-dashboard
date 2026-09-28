import { QRCodeSVG } from 'qrcode.react';
import { Badge } from '@/components/ui';
import { buildSimulatorQrPayload } from '@/lib/simulator/qr';

interface SimulatorQrCodeProps {
  paymentId: string;
  /** Visual size in px; clamped for readability without crowding actions. */
  size?: number;
}

/**
 * Renders a simulation-only QR for Checkout Simulator (QRIS method).
 * Does not initiate payment; scanning does nothing on a real wallet.
 */
export function SimulatorQrCode({ paymentId, size = 180 }: SimulatorQrCodeProps) {
  const payload = buildSimulatorQrPayload(paymentId);
  const qrSize = Math.min(220, Math.max(144, size));

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        QRIS Payment Simulation
      </p>

      <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
        <QRCodeSVG
          value={payload}
          size={qrSize}
          level="M"
          marginSize={2}
          title="Simulation QR code for payment checkout"
        />
      </div>

      <Badge variant="warning" className="uppercase tracking-wide">
        Simulation Only
      </Badge>

      <p className="text-center text-xs text-muted-foreground max-w-[16rem] leading-relaxed">
        QR ini hanya untuk simulasi dan tidak dapat digunakan untuk pembayaran nyata.
      </p>
    </div>
  );
}
