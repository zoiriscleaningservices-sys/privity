/**
 * Server error code → what happened + what the user can do next.
 * Codes come from S2 (`live.fail(CODE)` and `{ok:false, code}` results) plus two transport codes.
 */

export type ErrorAction =
  | 'retry'
  | 'dismiss'
  | 'get_coins'
  | 'send_outside_battle'
  | 'leave'
  | 'wait';

export interface ErrorDescription {
  title: string;
  body: string;
  action: ErrorAction;
}

const MAP: Record<string, ErrorDescription> = {
  NETWORK_ERROR: { title: 'You are offline', body: 'Nothing was sent. Check your connection and try again.', action: 'retry' },
  SERVER_ERROR: { title: 'Something went wrong', body: 'The server could not complete that. Try again in a moment.', action: 'retry' },
  RETRY: { title: 'Busy right now', body: 'The LIVE was updating. Try again.', action: 'retry' },

  INSUFFICIENT_FUNDS: { title: 'Not enough coins', body: 'Your balance does not cover this gift.', action: 'get_coins' },
  BATTLE_LOCKED: {
    title: 'The battle has ended',
    body: 'Gifts no longer affect the battle score. You can still send it as a LIVE gift.',
    action: 'send_outside_battle',
  },
  BATTLE_NOT_STARTED: {
    title: 'Battle not started yet',
    body: 'Gifts sent now will not count toward the battle. Send it as a LIVE gift, or wait for the start.',
    action: 'send_outside_battle',
  },
  BATTLE_BREAK: {
    title: 'Between rounds',
    body: 'Gifts sent during the break do not count. Send it as a LIVE gift, or wait for the next round.',
    action: 'send_outside_battle',
  },
  BATTLE_CHANGED: { title: 'The battle changed', body: 'Review the stage and send again.', action: 'dismiss' },
  BATTLE_SCORING_ACTIVE: { title: 'Battle is live', body: 'Gifts count toward the battle right now.', action: 'dismiss' },
  INVALID_QUANTITY: { title: 'Invalid amount', body: 'Choose a quantity allowed for this gift.', action: 'dismiss' },
  GIFT_UNAVAILABLE: { title: 'Gift unavailable', body: 'This gift is no longer offered. Pick another one.', action: 'dismiss' },
  CANNOT_GIFT_SELF: { title: 'That is your LIVE', body: 'Hosts cannot send gifts to themselves.', action: 'dismiss' },
  RECIPIENT_WALLET_MISSING: { title: 'Gifts are paused', body: 'This creator cannot receive gifts right now.', action: 'dismiss' },
  IDEMPOTENCY_KEY_REUSED: { title: 'Duplicate request', body: 'Send the gift again from the tray.', action: 'dismiss' },
  INVALID_IDEMPOTENCY_KEY: { title: 'Could not send', body: 'Send the gift again from the tray.', action: 'dismiss' },

  RATE_LIMITED: { title: 'Slow down a little', body: 'You are sending messages too quickly. Wait a moment.', action: 'wait' },
  COMMENTS_DISABLED: { title: 'Comments are off', body: 'The host turned comments off for now.', action: 'dismiss' },
  MUTED: { title: 'You are muted', body: 'The host muted you in this LIVE for a while.', action: 'dismiss' },
  INVALID_COMMENT: { title: 'Message not sent', body: 'Comments must be 1–300 characters.', action: 'dismiss' },
  COMMENT_NOT_FOUND: { title: 'Already removed', body: 'That comment no longer exists.', action: 'dismiss' },

  LIVE_NOT_FOUND: { title: 'LIVE not found', body: 'This LIVE does not exist anymore.', action: 'leave' },
  LIVE_NOT_ACTIVE: { title: 'This LIVE has ended', body: 'The creator is no longer live.', action: 'leave' },
  LIVE_ACCESS_DENIED: { title: 'Private LIVE', body: 'You do not have access to this LIVE.', action: 'leave' },
  NOT_AUTHORIZED: { title: 'Not allowed', body: 'You do not have permission to do that here.', action: 'dismiss' },
  INVALID_TARGET: { title: 'Not possible', body: 'That action cannot be applied to this person.', action: 'dismiss' },
  BLOCKED: { title: 'Unavailable', body: 'You cannot interact with this account.', action: 'dismiss' },
  USER_NOT_FOUND: { title: 'Account not found', body: 'This account no longer exists.', action: 'dismiss' },

  ALREADY_GUEST: { title: 'You are already on stage', body: 'You joined this LIVE as a guest.', action: 'dismiss' },
  GUEST_REMOVED_BY_HOST: { title: 'Request unavailable', body: 'The host removed you from the stage earlier in this LIVE.', action: 'dismiss' },
  GUEST_REQUEST_COOLDOWN: { title: 'Please wait', body: 'Your last request was declined. You can ask again in a minute.', action: 'wait' },
  GUEST_UNAVAILABLE: { title: 'Cannot join the stage', body: 'You cannot be a guest right now (for example, while hosting your own LIVE).', action: 'dismiss' },
  GUEST_QUEUE_FULL: { title: 'Requests are full', body: 'Too many people are waiting. Try again later.', action: 'wait' },
  GUEST_SLOTS_FULL: { title: 'Stage is full', body: 'Remove a guest before accepting another one.', action: 'dismiss' },
  GUEST_REQUEST_NOT_FOUND: { title: 'Request expired', body: 'This person cancelled or already joined.', action: 'dismiss' },
  GUEST_NOT_FOUND: { title: 'Guest already left', body: 'This person is no longer on stage.', action: 'dismiss' },
  NOT_LIVE: { title: 'You are not live', body: 'Start a LIVE first.', action: 'dismiss' },
};

export function describeLiveError(code: string, serverMessage?: string): ErrorDescription {
  const known = MAP[code];
  if (known) return known;
  return {
    title: 'Something went wrong',
    body: serverMessage && serverMessage !== code ? serverMessage : 'Please try again.',
    action: 'retry',
  };
}

export const KNOWN_ERROR_CODES = Object.freeze(Object.keys(MAP));
