// Mock Merchant Receiver API calls — separate from Payment Gateway API.
// This module queries the Mock Merchant Receiver for received webhook events.
// It does NOT call the Payment Gateway External Client API.

// import.meta.env is always defined under Vite; the fallback keeps plain
// Node evaluation (tests) from crashing on module import. Matches client.ts.
const receiverEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | boolean | undefined>;
}).env ?? {};

const RECEIVER_BASE_URL =
  typeof receiverEnv.VITE_MOCK_RECEIVER_URL === 'string' && receiverEnv.VITE_MOCK_RECEIVER_URL
    ? receiverEnv.VITE_MOCK_RECEIVER_URL
    : 'http://127.0.0.1:9090';

export interface ReceiverEvent {
  received_at: string;
  event_id: string;
  event_type: string;
  transaction_id?: string;
  merchant_id?: string;
  status?: string;
  signature_valid: boolean;
  raw_body: string;
}

export interface ReceiverEventsResponse {
  events: ReceiverEvent[];
  count: number;
}

export async function getReceiverEvents(): Promise<ReceiverEventsResponse> {
  const response = await fetch(`${RECEIVER_BASE_URL}/events`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`Receiver returned ${response.status}`);
  }

  return response.json();
}
