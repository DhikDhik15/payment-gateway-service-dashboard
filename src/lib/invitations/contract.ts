/** Backend invitation route helpers. Tokens are only encoded into the request path. */
export function invitationResourcePath(token: string): string {
  const value = token.trim();
  if (!value) throw new Error('Invitation token is required.');
  return `/api/v1/invitations/${encodeURIComponent(value)}`;
}

export function invitationAcceptPath(token: string): string {
  return `${invitationResourcePath(token)}/accept`;
}

export function invitationErrorMessage(code: string | undefined, fallback = 'This invitation is no longer available.'): string {
  switch (code) {
    case 'INVITATION_NOT_FOUND':
      return 'This invitation is invalid, expired, already accepted, or no longer available.';
    case 'INVITATION_ALREADY_ACCEPTED':
      return 'This invitation has already been accepted.';
    case 'EMAIL_ALREADY_EXISTS':
      return 'An account with this email already exists.';
    case 'MERCHANT_INACTIVE':
      return 'This merchant is not active, so the invitation cannot be accepted.';
    default:
      return fallback;
  }
}
