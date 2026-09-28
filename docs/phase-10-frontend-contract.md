# Phase 10 frontend contract notes

The frontend was implemented against the assembled Go router and handler behavior, not the generated Swagger annotations where they disagreed.

## Dashboard routes consumed

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`
- `GET /api/v1/dashboard/overview`
- `GET/POST /api/v1/dashboard/payments`, `GET /api/v1/dashboard/payments/:payment_id`
- `GET /api/v1/dashboard/refunds`, `GET /api/v1/dashboard/refunds/:refund_id`, `POST /api/v1/dashboard/payments/:payment_id/refunds`
- `GET/PATCH /api/v1/dashboard/users`, `POST /api/v1/dashboard/users/invite`, `PATCH /api/v1/dashboard/users/:user_id/status`, `PATCH /api/v1/dashboard/users/:user_id/role`, `PATCH /api/v1/dashboard/me/password`
- `GET/POST /api/v1/dashboard/api-keys`, `POST /api/v1/dashboard/api-keys/:id/revoke`
- `GET/PUT/DELETE /api/v1/dashboard/webhook-config`, `POST /api/v1/dashboard/webhook-config/rotate`
- `GET /api/v1/dashboard/webhooks`, `GET /api/v1/dashboard/webhooks/:id`, `POST /api/v1/dashboard/webhooks/:id/retry`
- `GET /api/v1/dashboard/reconciliation/mismatches`, `GET /api/v1/dashboard/reconciliation/mismatches/:id`
- `GET /api/v1/dashboard/settings`
- `POST /api/v1/dashboard/legacy-credential/migrate`, `POST /api/v1/dashboard/legacy-credential/disable`
- `GET /api/v1/invitations/:token`, `POST /api/v1/invitations/:token/accept`

## Logout semantics

The dashboard keeps access JWTs in module memory only and sends the current
memory bearer on logout so the backend can revoke the stable session identity
(`sid`) even if refresh rotation races the logout request. A module-memory auth
transition epoch prevents a delayed refresh response from restoring memory or
UI state after logout, terminal 401, or account switching. The refresh token
remains HttpOnly and is cleared by the server. Under the backend's bounded
stateless contract, an already-issued access JWT may remain usable until its
natural `exp` (default 15 minutes); logout prevents future refresh continuation
but does not create a JWT blacklist. Lifecycle checks still reject disabled
users and INACTIVE/SUSPENDED merchants on the next request.

## Contract-driven limitations

- The assembled dashboard API has no atomic API-key rotation route. The separate merchant integration route requires an API key and is not substituted with a fake dashboard call. The UI exposes create/revoke and explains the boundary.
- The production dashboard API exposes no QRIS/EMV payload or QR image. The separate public Phase 11.2B mock-payment DTO exposes a transaction-specific `qris_payload`; the public development page renders that exact value and never creates a replacement payload.
- The Phase 11.2B public mock-payment DTO is `{ reference, amount, currency, payment_method, status, expired_at, provider_transaction_id, qris_payload? }` inside the standard success envelope. It intentionally does not expose a gateway transaction ID; the frontend does not invent one.
- Merchant-scoped settlement routes are intentionally absent because settlement batches are provider-level and not merchant-owned.
- Dashboard payment creation supports the backend's integer IDR/QRIS contract and requires `Idempotency-Key`; the UI keeps one key across retries.
- Swagger annotations that describe bare response objects are stale in places. Runtime handlers return the standard `{ success, data, meta }` / `{ success: false, error, meta }` envelope, which the client validates.
