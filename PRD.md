# PRIVITY
## Product Requirements Document — MVP

**Product:** Privity  
**Tagline:** Private-first social feed for real connections  
**Document Version:** 1.0  
**Status:** Development Ready  
**Target Platforms:** iOS + Android  
**Primary Client:** React Native / Expo  
**Backend:** Node.js + NestJS + TypeScript  
**Database:** PostgreSQL  
**Infrastructure:** AWS + managed services  
**MVP Target:** 12–14 weeks with an experienced small team  

---

## 1. Executive Summary

Privity is a mobile-first social platform designed around private-first sharing, real connections, and smaller communities.

The product combines:
- Short-form video
- Image and text posts
- Conversational comments
- Following
- Discovery
- Privacy-controlled publishing
- Creator-oriented tools
- Community interaction

Unlike a conventional social network that primarily optimizes for algorithmic reach, Privity will initially emphasize user-controlled visibility and relationship-driven content.

The core product principle is:
> **Users should understand who can see what they share.**

Every post therefore has an explicit privacy level:
- **Public**
- **Followers**
- **Close Friends**

The MVP will intentionally avoid an overly complex recommendation algorithm. The initial feed will prioritize content from followed accounts while maintaining chronological behavior and basic personalization.

---

## 2. Product Vision

Privity aims to become a social platform where users can share content without feeling that every post must be optimized for an algorithm or broadcast to strangers.

The long-term platform will support:
- Private social circles
- Public creators
- Communities
- Channels
- Direct messaging
- Short-form video
- Stories
- Creator monetization
- Subscriptions
- Live/audio experiences
- Advanced discovery

The MVP establishes the core social graph, content system, privacy architecture, moderation infrastructure, and creator foundation required for those future capabilities.

---

## 3. Strategic Objectives

### 3.1 First 12-Month Goals
| Goal | Target |
| :--- | :--- |
| iOS launch | Yes |
| Android launch | Yes |
| MAU within 6 months | 50,000 |
| Day-7 retention | >25% among engaged cohorts |
| Creators onboarded | 500 |
| First creator payments | By month 6 |

---

## 4. Target Users

### 4.1 Primary Audience
- **Privacy-conscious social users (Adults ~18–35):**
  - Prefer smaller social circles
  - Want control over audience visibility
  - Are uncomfortable with highly algorithmic feeds
  - Want to share photos/videos without broadcasting everything publicly
- **Creators:**
  - Want closer relationships with followers
  - Want engaged audiences rather than purely passive views
  - May eventually monetize through tips and subscriptions
  - Need simple content creation tools

### 4.2 Secondary Audience
- Hobby communities
- Micro-influencers
- Niche interest groups
- Local communities
- Podcasters
- Independent artists
- Lifestyle creators
- Small businesses

---

## 5. Product Principles

1. **Privacy by Default:** Privacy must be understandable at the moment content is published.
2. **Simple Creation:** Creating a post should require as few steps as possible.
3. **Relationship-Driven Feed:** Following people should meaningfully affect what appears in the Home feed.
4. **Minimal Algorithmic Manipulation:** The MVP should not attempt to maximize engagement through an opaque recommendation system.
5. **Safety From Day One:** Reporting, blocking, moderation, rate limiting, and administrative controls are MVP requirements.
6. **Scalable Foundations:** The MVP should be architected so that additional services can be extracted as usage grows.

---

## 6. MVP Scope

### 6.1 Included in MVP
- **Authentication:** Email/password signup & login, phone OTP, email verification, refresh tokens, optional Apple/Google OAuth, password reset.
- **Profiles:** Avatar, display name, username, bio, links, public/private toggle, followers/following count, pinned post.
- **Social Graph:** Follow, unfollow, follow approval for private accounts, follower/following lists, block.
- **Content:** Text posts, single image posts, videos up to 60s, captions, tags, privacy selection, video trimming & cover selection, scheduling, edit caption within 15 mins, delete post, save post.
- **Feed:** Home feed (follow-first ranking, chronological behavior, cursor pagination, basic personalization).
- **Discovery:** User search, tag search, trending posts, suggested users, suggested channels architecture.
- **Interactions:** Like, comment, one-level comment replies, external share link, save.
- **Notifications:** Push notifications, in-app notifications, notification preferences.
- **Moderation:** Reporting (user, post, comment), blocking, automated thresholds, admin moderation dashboard, audit logs.
- **Infrastructure:** Object storage, CDN, video transcoding & thumbnails, background jobs (SQS/Redis), analytics, error monitoring, backups.
- **Compliance:** Data export, account deletion, privacy policy, terms of service, GDPR/CCPA foundational support.

---

## 7. Explicitly Out of MVP

- Full direct messaging & group messaging
- Voice notes & audio rooms
- ML recommendation engine
- Stories
- Remix / Duet
- Creator subscriptions & paid badges
- Advanced creator analytics
- Paid channels & advertising
- Full human moderation organization
- Complex channel-management tools
- Advanced live streaming

---

## 8. User Roles & Permissions

- **Visitor:** View permitted public content, view public profiles, sign up, sign in.
- **Registered User:** Create profile, follow users, publish content, like/comment/save, report, block, manage privacy.
- **Creator:** Registered user with creator capabilities (future: tips, subscriptions, analytics).
- **Moderator:** Review reports, remove content, warn users, suspend accounts, review moderation history.
- **Administrator:** Manage moderators, system-wide moderation tools, audit logs, platform configuration, manage users.

---

## 9. Authentication & Onboarding

- Unique, case-insensitive, URL-safe usernames.
- Short-lived Access Tokens + Rotatable Revocable Refresh Tokens.
- Onboarding flow: Welcome -> Profile setup -> Choose interests -> Suggested accounts -> Privacy intro -> Feed.

---

## 10. Privacy Model (Core Architecture)

### 10.1 Account Privacy
- **Public Account:** Anyone can view permitted public posts.
- **Private Account:** Only approved followers can view follower-restricted content.

### 10.2 Post Privacy
- **Public:** Visible to permitted users according to account status.
- **Followers:** Visible only to approved followers.
- **Close Friends:** Visible only to users belonging to the author's close-friends audience.

### 10.3 Privacy Enforcement (Server-Side)
Every content request evaluates:
$$\text{Authorized} = f(\text{Author}, \text{Viewer}, \text{AccountPrivacy}, \text{PostPrivacy}, \text{FollowStatus}, \text{CloseFriendStatus}, \text{BlockStatus}, \text{ModerationStatus})$$

---

## 11. Feed & Cursor Pagination

- Request: `GET /api/v1/feed?cursor=<cursor>&limit=20`
- Cursor encodes `(created_at, id)`.
- Follow-first ranking with chronological tie-breaking.

---

## 12. Post Creation & Media

- Text, single Image, Video ($\le 60\text{s}$).
- Asynchronous video transcoding and thumbnail generation via background worker queue.
- Signed URLs for authorized viewing of private content.
- Caption editing permitted within 15 minutes of publication.

---

## 13. Social Interactions

- **Likes:** Unique `(user_id, post_id)` constraint.
- **Comments:** Root comments + single-level replies (no infinite nesting).
- **Shares:** External shareable link generation.

---

## 14. Moderation & Admin Dashboard

- Web application dashboard with RBAC.
- Queues: Open reports, active suspensions, audit logs, user management.
- Actions: Dismiss, warn, remove content, suspend, ban.

---

## 15. Technology Stack & Architecture

- **Client:** React Native / Expo (iOS + Android)
- **Admin Web App:** React / Next.js / Vite + Vanilla CSS
- **Backend:** Node.js + NestJS + TypeScript (Modular Monolith)
- **Database:** PostgreSQL (with connection pooling, automated backups, indexes)
- **Cache & Queue:** Redis + BullMQ / AWS SQS
- **Storage & Media:** AWS S3 + CloudFront CDN + Transcoding (Mux or AWS MediaConvert / ffmpeg)
- **Search:** Algolia / PostgreSQL Full-Text
- **Monitoring:** Sentry, structured JSON logging
