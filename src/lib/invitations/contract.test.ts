import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationAcceptPath, invitationErrorMessage, invitationResourcePath } from './contract.ts';

test('invitation paths encode the opaque token and never place it in a query string', () => {
  assert.equal(invitationResourcePath('a token/with+symbols'), '/api/v1/invitations/a%20token%2Fwith%2Bsymbols');
  assert.equal(invitationAcceptPath('token'), '/api/v1/invitations/token/accept');
  assert.throws(() => invitationResourcePath('  '), /required/);
});

test('invitation errors distinguish safe user-facing outcomes', () => {
  assert.match(invitationErrorMessage('INVITATION_NOT_FOUND'), /invalid, expired/);
  assert.match(invitationErrorMessage('INVITATION_ALREADY_ACCEPTED'), /already/);
  assert.match(invitationErrorMessage('EMAIL_ALREADY_EXISTS'), /already exists/);
  assert.match(invitationErrorMessage('MERCHANT_INACTIVE'), /not active/);
});
