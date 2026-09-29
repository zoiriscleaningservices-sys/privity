# Privity — Private-First Social Feed for Real Connections

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Privity%20Web%20App-0A84FF?style=for-the-badge&logo=safari&logoColor=white)](https://zoiriscleaningservices-sys.github.io/privity/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-30D158?style=for-the-badge&logo=github)](https://zoiriscleaningservices-sys.github.io/privity/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **Private-first social feed designed around real human connections, transparent visibility, cryptographic authenticity, and zero algorithmic manipulation.**

🌐 **Live Web Application:** [https://zoiriscleaningservices-sys.github.io/privity/](https://zoiriscleaningservices-sys.github.io/privity/)

---

## 🏛️ Monorepo Structure

```
privity/
├── PRD.md                         # Full Product Requirements Document (MVP)
├── docker-compose.yml             # Local PostgreSQL 16 & Redis 7 services
├── packages/
│   └── types/                     # Shared TypeScript models, enums & DTOs
│       ├── src/
│       │   ├── privacy.ts         # Privacy levels (public, followers, close_friends)
│       │   ├── user.ts            # User profiles & role definitions
│       │   ├── post.ts            # Text, image, video post interfaces
│       │   ├── comment.ts         # 1-level reply nesting comment types
│       │   ├── follow.ts          # Follow & request relationships
│       │   ├── feed.ts            # Cursor-based feed contracts
│       │   ├── moderation.ts      # Reports, audit logs & admin action types
│       │   └── notification.ts    # Notification stream types
└── apps/
    ├── api/                       # NestJS + TypeScript + PostgreSQL + Prisma API
    │   ├── prisma/schema.prisma   # Production-ready PostgreSQL database model
    │   ├── src/
    │   │   ├── privacy/           # Server-side Privacy Authorization Engine
    │   │   ├── auth/              # JWT Auth, Signup, Login, Tokens
    │   │   ├── users/             # Profiles, close friends, data export & deletion
    │   │   ├── follows/           # Follow, unfollow, approval workflows
    │   │   ├── posts/             # Post creation, 15-min caption edits, likes, saves
    │   │   ├── feed/              # Follow-first ranking, cursor pagination
    │   │   ├── comments/          # Root comments + 1-level reply enforcement
    │   │   ├── moderation/        # User reports, blocks, admin actions, audit logs
    │   │   ├── search/            # Safe discovery without private leakages
    │   │   └── media/             # Pre-signed S3 upload URLs & validation
    ├── mobile/                    # React Native / Expo Mobile Application
    │   ├── src/
    │   │   ├── screens/FeedScreen.tsx           # Follow-first feed with privacy filter tabs
    │   │   ├── screens/CreatePostModal.tsx      # Create flow with explicit privacy selector
    │   │   ├── screens/DiscoverScreen.tsx       # Suggested creators & trending tags
    │   │   ├── screens/NotificationsScreen.tsx  # Activity feed & follow request approval
    │   │   └── screens/ProfileScreen.tsx        # Profile with Public/Private switch & Close Friends
    │   └── App.tsx                              # 5-tab mobile navigation shell
    └── admin/                     # Vite + React Modern Web Admin Dashboard
        ├── src/
        │   ├── App.tsx            # Dashboard, Reports Queue, User Ban/Restore, Audit Log
        │   └── index.css          # Vanilla CSS Design System with dark mode & micro-animations
```

---

## ⚡ Quickstart

### 1. Start Local Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d
```

### 2. Run NestJS API
```bash
# Generate Prisma Client & Run DB migrations
npm run prisma:push --workspace=@privity/api

# Start API in dev mode with live reload
npm run dev:api
```
- API Endpoint: `http://localhost:4000/api/v1`
- Interactive OpenAPI / Swagger Docs: `http://localhost:4000/api/docs`

### 3. Run Web Admin Dashboard
```bash
npm run dev:admin
```
- Admin Dashboard URL: `http://localhost:3000`

### 4. Run Mobile Client (Expo)
```bash
npm run dev:mobile
```
- Press `w` for Expo Web, `a` for Android Emulator, or scan QR with Expo Go on iOS.

---

## 🔒 Privacy Model Implementation

Every post and feed interaction is evaluated server-side by the `PrivacyService`:

$$\text{CanView} = f(\text{Author}, \text{Viewer}, \text{AccountPrivacy}, \text{PostPrivacy}, \text{FollowStatus}, \text{CloseFriendStatus}, \text{BlockStatus}, \text{ModerationStatus})$$

- **Public**: Anyone can view (unless author account is private, then restricted to followers).
- **Followers**: Approved followers only.
- **Close Friends**: Whitelisted close friends only.
- **Client Trust**: 0% (Client is never trusted to determine visibility).
