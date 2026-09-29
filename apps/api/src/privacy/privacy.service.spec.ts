import { PrivacyService } from './privacy.service';
import { PrivacyCheckContext } from '@privity/types';

describe('PrivacyService', () => {
  let service: PrivacyService;

  beforeEach(() => {
    // Instantiate with mock prisma
    service = new PrivacyService({} as any);
  });

  const baseContext: PrivacyCheckContext = {
    authorId: 'user-1',
    authorAccountPrivacy: 'public',
    postPrivacy: 'public',
    viewerId: 'user-2',
    isAuthor: false,
    isFollower: false,
    isCloseFriend: false,
    isBlockedByAuthor: false,
    isViewerBlockingAuthor: false,
    isAuthorSuspendedOrBanned: false,
  };

  it('allows author to always see their own content', () => {
    const context: PrivacyCheckContext = {
      ...baseContext,
      isAuthor: true,
      postPrivacy: 'close_friends',
      isCloseFriend: false,
    };
    const result = service.evaluatePrivacy(context);
    expect(result.canView).toBe(true);
  });

  it('denies access if author is suspended or banned', () => {
    const context: PrivacyCheckContext = {
      ...baseContext,
      isAuthorSuspendedOrBanned: true,
    };
    const result = service.evaluatePrivacy(context);
    expect(result.canView).toBe(false);
    expect(result.reason).toContain('suspended or banned');
  });

  it('denies access if author blocks viewer or viewer blocks author', () => {
    const context1: PrivacyCheckContext = {
      ...baseContext,
      isBlockedByAuthor: true,
    };
    expect(service.evaluatePrivacy(context1).canView).toBe(false);

    const context2: PrivacyCheckContext = {
      ...baseContext,
      isViewerBlockingAuthor: true,
    };
    expect(service.evaluatePrivacy(context2).canView).toBe(false);
  });

  it('enforces Close Friends privacy restriction', () => {
    const nonFriendContext: PrivacyCheckContext = {
      ...baseContext,
      postPrivacy: 'close_friends',
      isCloseFriend: false,
    };
    expect(service.evaluatePrivacy(nonFriendContext).canView).toBe(false);

    const friendContext: PrivacyCheckContext = {
      ...baseContext,
      postPrivacy: 'close_friends',
      isCloseFriend: true,
    };
    expect(service.evaluatePrivacy(friendContext).canView).toBe(true);
  });

  it('enforces Followers-only post privacy', () => {
    const nonFollowerContext: PrivacyCheckContext = {
      ...baseContext,
      postPrivacy: 'followers',
      isFollower: false,
    };
    expect(service.evaluatePrivacy(nonFollowerContext).canView).toBe(false);

    const followerContext: PrivacyCheckContext = {
      ...baseContext,
      postPrivacy: 'followers',
      isFollower: true,
    };
    expect(service.evaluatePrivacy(followerContext).canView).toBe(true);
  });

  it('restricts public posts if author account is Private to approved followers only', () => {
    const nonFollowerContext: PrivacyCheckContext = {
      ...baseContext,
      authorAccountPrivacy: 'private',
      postPrivacy: 'public',
      isFollower: false,
    };
    expect(service.evaluatePrivacy(nonFollowerContext).canView).toBe(false);

    const followerContext: PrivacyCheckContext = {
      ...baseContext,
      authorAccountPrivacy: 'private',
      postPrivacy: 'public',
      isFollower: true,
    };
    expect(service.evaluatePrivacy(followerContext).canView).toBe(true);
  });

  it('allows public posts from public accounts to be viewed by anyone', () => {
    const visitorContext: PrivacyCheckContext = {
      ...baseContext,
      viewerId: null,
    };
    expect(service.evaluatePrivacy(visitorContext).canView).toBe(true);
  });
});
