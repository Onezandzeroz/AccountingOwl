# Hermes Agent — LLM Implementation Guide

> **This document is written for an LLM to follow.** It contains the exact file contents,
> interfaces, dependencies, wiring points, and constraints needed to integrate the Hermes
> AI overlay agent into the AlphaFlow-ZIPAccessR-D Next.js application.
> Every detail is precise — do not deviate unless explicitly noted.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Target: AlphaFlow-ZIPAccessR-D │
│              (Next.js App Router app)       │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  src/components/hermes/              │   │  ← FRONTEND (7 files + barrel export)
│  │  ├── index.ts        (barrel)        │   │
│  │  ├── types.ts        (interfaces)    │   │
│  │  ├── useHermesSocket.ts (socket hook) │   │
│  │  ├── HermesOverlay.tsx (orchestrator)│   │
│  │  ├── HermesFab.tsx    (owl button)   │   │
│  │  ├── HermesPanel.tsx  (chat panel)  │   │
│  │  └── HermesNotificationCard.tsx      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  public/                              │   │  ← ASSETS
│  │  ├── hermes-owl.webp   (animated owl) │   │
│  │  └── hermes-owl-static.png (static)   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  mini-services/hermes-agent/         │   │  ← BACKEND (6 files)
│  │  ├── package.json                      │   │
│  │  ├── config.ts          (settings)     │   │
│  │  ├── knowledge-base.ts (system prompt)│   │
│  │  ├── tenant-provider.ts (data layer)  │   │
│  │  ├── utils.ts          (helpers)      │   │
│  │  └── index.ts          (server)       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  prisma/schema.prisma                  │   │  ← DATABASE
│  │  (User, Tenant, TenantMember,          │   │
│  │   HermesAgent, AgentReminder)          │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Communication Flow

```
Browser                    Next.js (3000)              Hermes Backend (3004)
   │                            │                            │
   │  <HermesOverlay />          │                            │
   │  renders in React tree      │                            │
   │                            │                            │
   │  socket.io-client ─────────┤                            │
   │  connects via              │   Caddy / reverse proxy    │
   │  /?XTransformPort=3004      │   routes to port 3004     │
   │                            │  ─────────────────────────►│
   │                            │                            │
   │  emits 'join'              │                            │
   │  {tenantId, userId, name}   │  ─────────────────────────►│
   │                            │                            │
   │  receives 'join-ack'       │                            │
   │  'agent-welcome'           │  ◄─────────────────────────│
   │  'notifications'          │                            │
   │                            │                            │
   │  user types message        │                            │
   │  emits 'chat'              │  ─────────────────────────►│
   │  {tenantId, message}       │                            │
   │                            │     LLM call               │
   │                            │     (z-ai-web-dev-sdk)     │
   │  receives 'chat-typing'    │  ◄─────────────────────────│
   │  'chat-response' (chunks)  │  ◄── streamed chunks ─────│
   │  'chat-complete'           │  ◄─────────────────────────│
   │                            │                            │
```

### Gateway / Proxy Requirement

The frontend connects using the `XTransformPort` query parameter pattern:

```
io('/?XTransformPort=3004')
```

This requires a reverse proxy (Caddy, Nginx, etc.) that routes requests with
`XTransformPort=3004` to localhost:3004. If the target app uses a different
proxy mechanism, update `useHermesSocket.ts` line 34 accordingly:

```typescript
// Current (XTransformPort gateway):
const socket = io(`/?XTransformPort=${servicePort}`, { ... })

// Alternative (direct connection):
const socket = io(`http://localhost:${servicePort}`, { ... })
```

---

## 2. Frontend Implementation

### 2.1 Required npm Dependencies

The target app's `package.json` MUST have these dependencies (most are likely already present):

```json
{
  "dependencies": {
    "socket.io-client": "^4.8.0",
    "framer-motion": "^11.0.0",
    "react-markdown": "^9.0.0",
    "lucide-react": "^0.400.0",
    "@radix-ui/react-scroll-area": "^1.0.0"
  }
}
```

The following shadcn/ui components are used — verify they exist in the target's `src/components/ui/`:

| Component | File | Used By |
|-----------|------|---------|
| ScrollArea | `scroll-area.tsx` | HermesPanel.tsx |

### 2.2 Public Assets

Copy these two files into the target app's `public/` directory:

- **`public/hermes-owl.webp`** — Animated WebP (192×128px, looping, 12fps, ~167KB).
  A green-screened owl that has been chroma-keyed, horizontally flipped, and resized.
  Used as the FAB (floating action button) in the top-right corner.

- **`public/hermes-owl-static.png`** — Static PNG fallback (192×128px, ~18KB).
  Used in the chat panel header icon.

These are referenced with relative paths (`/hermes-owl.webp` and `/hermes-owl-static.png`).

### 2.3 Component Files

Create a directory `src/components/hermes/` and place these files inside it.
**Copy each file EXACTLY as provided — do not modify paths, imports, or styling unless
the Integration Wiring section (§5) instructs otherwise.**

#### File: `src/components/hermes/types.ts`

```typescript
export interface HermesOverlayProps {
  /** Current tenant identifier — used to fetch tenant-specific data */
  tenantId?: string;
  /** Current user identifier */
  userId?: string;
  /** Display name of current user */
  userName?: string;
  /** Port of the Hermes Agent mini-service (default: 3004) */
  servicePort?: number;
  /** Display name for the agent (default: "Hermes") */
  agentName?: string;
  /** Maximum visible notifications (default: 3) */
  maxVisibleNotifications?: number;
  /** Agent greeting override */
  greeting?: string;
  /** Whether to show the agent (default: true) */
  visible?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'hermes';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface HermesNotification {
  id: string;
  type: 'reminder' | 'deadline' | 'info';
  title: string;
  description?: string;
  dueDate?: string;
  read?: boolean;
}

export interface HermesConfig {
  enabled: boolean;
  personality: 'professional' | 'friendly' | 'concise';
  greeting?: string;
}
```

#### File: `src/components/hermes/useHermesSocket.ts`

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ChatMessage, HermesNotification } from './types';

interface UseHermesSocketReturn {
  isConnected: boolean;
  agentEnabled: boolean;
  messages: ChatMessage[];
  notifications: HermesNotification[];
  isTyping: boolean;
  sendMessage: (content: string) => void;
  dismissNotification: (id: string) => void;
}

export function useHermesSocket(options: {
  tenantId: string;
  userId: string;
  userName: string;
  servicePort: number;
}): UseHermesSocketReturn {
  const { tenantId, userId, userName, servicePort } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<HermesNotification[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = io(`/?XTransformPort=${servicePort}`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', { tenantId, userId, userName });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('join-ack', (data: { status: string; agentEnabled: boolean; tenantName: string }) => {
      setAgentEnabled(data.agentEnabled);
    });

    socket.on('agent-welcome', (data: { message: string; tenantName: string }) => {
      if (data.message) {
        setMessages((prev) => [
          { id: crypto.randomUUID(), role: 'hermes', content: data.message, timestamp: new Date() },
          ...prev,
        ]);
      }
    });

    socket.on('agent-status', (data: { agentEnabled: boolean; changedBy: string }) => {
      setAgentEnabled(data.agentEnabled);
    });

    socket.on('notifications', (data: Array<HermesNotification>) => {
      setNotifications((prev) => [...prev, ...data.map(n => ({ ...n, read: false }))]);
    });

    socket.on('notification', (data: HermesNotification) => {
      setNotifications((prev) => [...prev, { ...data, read: false }]);
    });

    socket.on('chat-typing', () => {
      setIsTyping(true);
    });

    socket.on('chat-response', (data: { chunk: string; done: boolean }) => {
      if (!streamingIdRef.current) {
        const msgId = crypto.randomUUID();
        streamingIdRef.current = msgId;
        setMessages((prev) => [...prev, {
          id: msgId, role: 'hermes', content: data.chunk, timestamp: new Date(), isStreaming: true,
        }]);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.isStreaming && lastMsg.id === streamingIdRef.current) {
            updated[updated.length - 1] = { ...lastMsg, content: lastMsg.content + data.chunk };
          }
          return updated;
        });
      }
    });

    socket.on('chat-complete', (data: { fullResponse: string; done: boolean }) => {
      setIsTyping(false);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.isStreaming && lastMsg.id === streamingIdRef.current) {
          updated[updated.length - 1] = {
            ...lastMsg, content: data.fullResponse || lastMsg.content, isStreaming: false,
          };
        }
        return updated;
      });
      streamingIdRef.current = null;
    });

    socket.on('chat-error', (data: { error: string }) => {
      setIsTyping(false);
      streamingIdRef.current = null;
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: 'hermes',
        content: `⚠️ ${data.error}`, timestamp: new Date(),
      }]);
    });

    socket.on('notification-dismissed', (data: { notificationId: string }) => {
      setNotifications((prev) => prev.filter((n) => n.id !== data.notificationId));
    });

    return () => { socket.disconnect(); };
  }, [tenantId, userId, userName, servicePort]);

  const sendMessage = useCallback((content: string) => {
    if (!socketRef.current || !isConnected || !agentEnabled) return;
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), role: 'user', content, timestamp: new Date(),
    }]);
    socketRef.current.emit('chat', { tenantId, message: content });
  }, [isConnected, agentEnabled, tenantId]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (socketRef.current && isConnected) {
      socketRef.current.emit('dismiss-notification', { notificationId: id });
    }
  }, [isConnected]);

  return { isConnected, agentEnabled, messages, notifications, isTyping, sendMessage, dismissNotification };
}
```

#### File: `src/components/hermes/HermesFab.tsx`

Animated owl button. References `/hermes-owl.webp`. Transparent background. 192×192 container (h-48 w-48 in Tailwind). Scales on hover/tap. Shows amber typing dots and notification badge.

```typescript
'use client';

import { motion } from 'framer-motion';

interface HermesFabProps {
  onClick: () => void;
  hasNotifications: boolean;
  isTyping: boolean;
}

export function HermesFab({ onClick, hasNotifications, isTyping }: HermesFabProps) {
  return (
    <motion.button
      onClick={onClick}
      className="pointer-events-auto group relative flex h-48 w-48 items-center justify-center rounded-full transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2"
      style={{ background: 'transparent' }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.92 }}
      aria-label="Open Hermes AI assistant"
    >
      <motion.div
        className="absolute inset-[-4px] rounded-full opacity-0 group-hover:opacity-100"
        style={{ background: 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, transparent 70%)' }}
        animate={hasNotifications ? { scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] } : {}}
        transition={hasNotifications ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
      />
      <motion.div
        className="relative"
        animate={isTyping ? { y: [0, -3, 0] } : {}}
        transition={isTyping ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        <img src="/hermes-owl.webp" alt="" className="h-42 w-auto object-contain drop-shadow-lg" draggable={false} />
      </motion.div>
      {isTyping && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-2 w-2 rounded-full bg-amber-400"
              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}
      {hasNotifications && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900"
        >
          !
        </motion.span>
      )}
    </motion.button>
  );
}
```

#### File: `src/components/hermes/HermesPanel.tsx`

Glassmorphism chat panel. References `/hermes-owl-static.png` in header. Uses `react-markdown` for message rendering. Uses shadcn `ScrollArea`. Positioned `fixed top-56 right-4 z-[10000]`.

**CRITICAL**: This file imports from `@/components/ui/scroll-area` — the target app MUST have this shadcn component.

Full file contents: see `HermesPanel.tsx` in the source. It is 257 lines. Do not truncate or abbreviate when copying.

#### File: `src/components/hermes/HermesNotificationCard.tsx`

Semi-transparent amber notification toast cards. Auto-dismiss after 8 seconds with slide-out animation. Uses lucide icons: `X`, `Bell`, `Clock`, `Info`.

Full file contents: see `HermesNotificationCard.tsx` in the source. It is 89 lines.

#### File: `src/components/hermes/HermesOverlay.tsx`

Root orchestrator component. Composes FAB + Panel + Notifications. This is the **single entry point** consumers use.

**CRITICAL**: All z-index layering:
- Overlay wrapper: `z-[9999]` (with `pointer-events-none`)
- FAB: `z-[10002]` (with `pointer-events-auto`)
- Notifications: `z-[10001]` (with `pointer-events-auto`)
- Panel: `z-[10000]` (with `pointer-events-auto`)

**CRITICAL**: The `useEffect` dependency array in `useHermesSocket` includes `[tenantId, userId, userName, servicePort]`. If any of these change, the socket will disconnect and reconnect. In the target app, if the user switches tenants, pass the new `tenantId` and the hook will handle reconnection automatically.

Default values (used when props are omitted — useful for development):
```
DEFAULT_TENANT_ID    = 'alphaflow-aps'
DEFAULT_USER_ID     = 'demo-user-1'
DEFAULT_USER_NAME   = 'Mikkel Andersen'
DEFAULT_SERVICE_PORT = 3004
DEFAULT_AGENT_NAME  = 'Hermes'
DEFAULT_MAX_NOTIFICATIONS = 3
```

Full file contents: see `HermesOverlay.tsx` in the source. It is 83 lines.

#### File: `src/components/hermes/index.ts` (barrel export)

```typescript
export { HermesOverlay } from './HermesOverlay'
export type { HermesOverlayProps, ChatMessage, HermesNotification, HermesConfig } from './types'
```

---

## 3. Backend Implementation

### 3.1 Mini-Service Location

```
mini-services/hermes-agent/
├── package.json          # @alphaflow/hermes-agent v1.0.0
├── config.ts             # All tunable settings (port, language, streaming, etc.)
├── knowledge-base.ts    # System prompt + Danish accounting knowledge
├── tenant-provider.ts    # TenantProvider interface + MockTenantProvider + DB skeleton
├── utils.ts              # splitIntoChunks() + buildTenantContext()
└── index.ts              # Socket.IO server entry point (port 3004)
```

### 3.2 Dependencies

```json
{
  "name": "@alphaflow/hermes-agent",
  "version": "1.0.0",
  "main": "index.ts",
  "scripts": {
    "dev": "bun --hot index.ts",
    "start": "bun index.ts"
  },
  "dependencies": {
    "socket.io": "^4.8.0",
    "z-ai-web-dev-sdk": "^0.0.18"
  }
}
```

The mini-service runs independently with `bun run dev` (hot reload) or `bun run start`.

### 3.3 Configuration (`config.ts`)

```typescript
export interface HermesConfig {
  port: number              // 3004
  agentName: string         // "Hermes"
  defaultLanguage: string  // "da"
  maxConversationHistory: number  // 20
  streamingChunkSize: number     // 20 (chars per chunk)
  streamingChunkDelay: number    // 30 (ms between chunks)
  reminderCheckInterval: number  // 60000 (ms, check reminders)
  reminderWindowDays: number     // 7 (look-ahead days)
  corsOrigin: string             // "*" or specific origin
}
```

### 3.4 Socket.IO Events (Wire Protocol)

**These events MUST match exactly between frontend and backend.** Do not rename them.

| Event | Direction | Payload Shape | Description |
|-------|-----------|---------------|-------------|
| `join` | Client→Server | `{ tenantId: string, userId: string, userName: string }` | Register socket for a tenant |
| `join-ack` | Server→Client | `{ status: string, agentEnabled: boolean, tenantName: string }` | Join confirmed |
| `agent-welcome` | Server→Client | `{ message: string, tenantName: string }` | Welcome message after join |
| `agent-status` | Server→Client | `{ agentEnabled: boolean, changedBy: string }` | Agent toggled |
| `chat` | Client→Server | `{ tenantId: string, message: string }` | User sends a message |
| `chat-typing` | Server→Client | `{ typing: true }` | LLM processing started |
| `chat-response` | Server→Client | `{ chunk: string, done: false }` | Streaming text chunk |
| `chat-complete` | Server→Client | `{ fullResponse: string, done: true }` | Final response |
| `chat-error` | Server→Client | `{ error: string }` | Error occurred |
| `toggle-agent` | Client→Server | `{ tenantId: string, enabled: boolean }` | Toggle agent on/off |
| `notifications` | Server→Client | `HermesNotification[]` | Batch of pending on join |
| `notification` | Server→Client | `HermesNotification` | Proactive single notification |
| `dismiss-notification` | Client→Server | `{ notificationId: string }` | Dismiss a notification |
| `notification-dismissed` | Server→Client | `{ notificationId: string }` | Dismissal confirmed |

### 3.5 LLM Integration (`index.ts` lines 141–148)

The backend uses `z-ai-web-dev-sdk` for LLM calls. The prompt is assembled as:

```
[buildSystemPrompt output]       ← knowledge-base.ts
+
[buildTenantContext output]      ← utils.ts (tenant financial data)
+
[SAMTALESHISTORIK:]              ← last 20 messages
  Bruger: <msg>
  Hermes: <msg>
  ...
+
Bruger: <current message>
Hermes:
```

LLM call pattern:
```typescript
const zai = await ZAI.create()
const completion = await zai.chat.completions.create({
  messages: [{ role: 'assistant', content: fullPrompt }],
  thinking: { type: 'disabled' },
})
```

**To swap to a different LLM provider**, only modify lines 142–148 in `index.ts`. The rest of the architecture (socket events, streaming simulation, tenant context) remains unchanged.

### 3.6 TenantProvider Pattern

The backend abstracts data access behind a `TenantProvider` interface:

```typescript
interface TenantProvider {
  getTenant(tenantId: string): Promise<TenantData | null>
  isAgentEnabled(tenantId: string): boolean
  setAgentEnabled(tenantId: string, enabled: boolean): void
  getReminders(tenantId: string): AgentNotification[]
  dismissReminder(tenantId: string, reminderId: string): void
  getConversationHistory(tenantId: string): ConversationMessage[]
  addMessage(tenantId: string, message: ConversationMessage): void
}
```

**In production**, replace `MockTenantProvider` with a class that queries the real database.
The `tenant-provider.ts` file contains a commented-out `YourDatabaseTenantProvider` skeleton
showing the Prisma query pattern. To swap providers, change ONE line in `index.ts` line 23:

```typescript
const tenantProvider: TenantProvider = new MockTenantProvider()
// Change to:
const tenantProvider: TenantProvider = new YourDatabaseTenantProvider(db)
```

### 3.7 Knowledge Base (`knowledge-base.ts`)

The `DANISH_ACCOUNTING_KNOWLEDGE` constant is prepended to every LLM prompt. It defines
Hermes's expertise: Danish Financial Statements Act, Moms (VAT), corporate tax, SKAT deadlines,
invoice requirements, EU cross-border rules, etc. Edit this string to customize the agent's
domain knowledge.

---

## 4. Database Schema (Prisma)

Add these models to the target app's `schema.prisma`:

```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  cvr       String?             @unique
  address   String?
  city      String?
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agent     HermesAgent?
  members   TenantMember[]
}

model TenantMember {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  role      String   @default("member") // owner | member | accountant
  joinedAt  DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model HermesAgent {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  enabled     Boolean  @default(false)
  personality String   @default("professional") // professional | friendly | concise
  greeting    String?
  systemPrompt String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  reminders   AgentReminder[]
}

model AgentReminder {
  id          String   @id @default(cuid())
  agentId     String
  title       String
  description String?
  dueDate     DateTime?
  status      String   @default("pending") // pending | completed | dismissed
  createdAt   DateTime @default(now())

  agent       HermesAgent @relation(fields: [agentId], references: [id], onDelete: Cascade)
}
```

---

## 5. Integration Wiring into AlphaFlow-ZIPAccessR-D

### Step 1: Copy Files

```
# Backend
cp -r mini-services/hermes-agent/   →  <target>/mini-services/hermes-agent/

# Frontend components
cp -r src/components/hermes/        →  <target>/src/components/hermes/

# Assets
cp public/hermes-owl.webp           →  <target>/public/hermes-owl.webp
cp public/hermes-owl-static.png      →  <target>/public/hermes-owl-static.png
```

### Step 2: Install Dependencies

```bash
cd <target>/mini-services/hermes-agent && bun install
cd <target> && bun add socket.io-client   # if not already installed
```

### Step 3: Add Prisma Models

Merge the Prisma models from §4 into the target's existing `prisma/schema.prisma`.
Run `bun run db:push` (SQLite) or `bun run db:migrate` (PostgreSQL).

### Step 4: Mount the Overlay

The Hermes overlay must render **above all other content**. Place it as the last child
in the root layout OR in the specific layout/page where it should appear.

**Option A: Root layout (Hermes visible everywhere)**
```tsx
// src/app/layout.tsx
import { HermesOverlay } from '@/components/hermes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>
        {children}
        {/* Hermes — renders as fixed overlay at z-index 9999 */}
        <HermesOverlay
          tenantId={session?.user?.tenantId}
          userId={session?.user?.id}
          userName={session?.user?.name}
          servicePort={3004}
        />
      </body>
    </html>
  )
}
```

**Option B: Dashboard layout only**
```tsx
// src/app/(dashboard)/layout.tsx
import { HermesOverlay } from '@/components/hermes'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HermesOverlay />
    </>
  )
}
```

**Option C: Zero-config (uses demo defaults — for testing only)**
```tsx
<HermesOverlay />  // Uses alphaflow-aps / demo-user-1 / Mikkel Andersen
```

### Step 5: Wire Authentication

Pass real user data from your auth system:

```tsx
// With NextAuth:
const session = await getServerSession(authOptions)
const tenantId = session?.user?.tenantId   // custom field on your User model

<HermesOverlay
  tenantId={tenantId}
  userId={session.user.id}
  userName={session.user.name}
/>
```

The `tenantId` MUST match a tenant ID known to the backend's `TenantProvider`.
If no match is found, the backend falls back to a blank default tenant.

### Step 6: Replace the Tenant Provider

In `mini-services/hermes-agent/index.ts` line 23, swap from mock to database:

```typescript
// FROM:
const tenantProvider: TenantProvider = new MockTenantProvider()

// TO:
import { PrismaClient } from '@prisma/client'
import { DatabaseTenantProvider } from './database-tenant-provider'
const db = new PrismaClient()
const tenantProvider: TenantProvider = new DatabaseTenantProvider(db)
```

Implement `DatabaseTenantProvider` following the skeleton in `tenant-provider.ts`
(lines 284–329). The key method is `getTenant()` which must return a `TenantData` object
matching the interface.

### Step 7: Start Both Services

```bash
# Terminal 1: Hermes backend
cd mini-services/hermes-agent && bun run dev

# Terminal 2: Next.js app
cd <target> && bun run dev
```

### Step 8: Configure Reverse Proxy

If using Caddy, ensure the `XTransformPort` routing is configured (see Caddyfile in source).
If using Nginx, add a WebSocket proxy location:

```nginx
location /hermes/ {
  proxy_pass http://127.0.0.1:3004/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

Then update `useHermesSocket.ts` line 34 to connect to `/hermes/?XTransformPort=3004`.

---

## 6. UI Details & Constraints

### Z-Index Stack
| Layer | z-index | pointer-events |
|-------|---------|----------------|
| Overlay wrapper | `z-[9999]` | `none` (pass-through) |
| Chat panel | `z-[10000]` | `auto` (interactive when open) |
| Notification cards | `z-[10001]` | `auto` |
| Owl FAB button | `z-[10002]` | `auto` |

### Positioning
| Element | Position |
|---------|----------|
| Owl FAB | `fixed top-4 right-4` |
| Notifications | `fixed top-56 right-6` (below FAB) |
| Chat panel | `fixed top-56 right-4 z-[10000]` |

### Color Theme
All amber/gold: `amber-50`, `amber-100`, `amber-200`, `amber-400`, `amber-500`, `amber-600`, `amber-700`, `amber-800`, `amber-900`, `amber-950`. Dark mode variants use `dark:amber-*`.

### Animation Library
All animations use `framer-motion` (`motion.button`, `motion.div`, `motion.span`).
Do NOT use CSS keyframe animations as a substitute — the spring physics are intentional.

### Notification Auto-Dismiss
Notifications auto-dismiss after 8 seconds with a 400ms exit animation delay.

---

## 7. Customization Points

| What | Where | How |
|------|-------|-----|
| Agent name | `config.ts` → `agentName` and `<HermesOverlay agentName="...">` | Change in both places |
| Language | `config.ts` → `defaultLanguage` and `knowledge-base.ts` | Edit system prompt |
| Domain knowledge | `knowledge-base.ts` → `DANISH_ACCOUNTING_KNOWLEDGE` | Edit the string |
| Streaming speed | `config.ts` → `streamingChunkSize`, `streamingChunkDelay` | Lower = faster |
| Reminder window | `config.ts` → `reminderWindowDays` | Days to look ahead |
| FAB size | `HermesFab.tsx` → `h-48 w-48` (Tailwind) | Change Tailwind classes |
| Panel size | `HermesPanel.tsx` → `md:w-[380px] md:h-[520px]` | Change Tailwind values |
| Panel position | `HermesPanel.tsx` + `HermesOverlay.tsx` | Change `top-56 right-4` |
| LLM provider | `index.ts` lines 142–148 | Replace `zai.chat.completions.create` |
| Port | `config.ts` → `port` + `<HermesOverlay servicePort={...}>` | Change in both places |

---

## 8. Testing Checklist

After integration, verify each of these:

- [ ] Owl animation visible in top-right corner, looping continuously
- [ ] Clicking the owl opens the chat panel (slides down from owl)
- [ ] Panel shows connection status: "Forbundet" (connected) or "Ikke forbundet" (disconnected)
- [ ] Welcome message appears from Hermes after connection
- [ ] Typing a message and pressing Enter (or clicking Send) triggers a response
- [ ] Response streams in word-by-word with blinking cursor
- [ ] Notification cards appear from top-right, auto-dismiss after 8 seconds
- [ ] Typing indicator dots appear below the owl while Hermes is thinking
- [ ] Red "!" badge appears on owl when notifications exist
- [ ] Panel closes when clicking the X button or clicking the owl again
- [ ] Input is disabled when agent is disconnected
- [ ] Dark mode works correctly (all amber classes have dark variants)
- [ ] Mobile responsive (panel is `calc(100vw-2rem)` on small screens)
- [ ] Hermes responds with Danish text (unless user writes in another language)

---

## 9. File Manifest

### Backend (mini-services/hermes-agent/)
```
config.ts              34 lines   — All settings
knowledge-base.ts      50 lines   — System prompt + domain knowledge
tenant-provider.ts    282 lines   — Data types + provider interface + mock data + DB skeleton
utils.ts              104 lines   — Text chunking + tenant context builder
index.ts              321 lines   — Socket.IO server + LLM calls + reminder system
package.json           14 lines   — Dependencies
install.sh            129 lines   — Installation script (optional)
```

### Frontend (src/components/hermes/)
```
index.ts                2 lines   — Barrel export
types.ts               41 lines   — TypeScript interfaces
useHermesSocket.ts    218 lines   — Socket.IO connection hook
HermesOverlay.tsx      83 lines   — Root orchestrator
HermesFab.tsx         111 lines   — Animated owl button
HermesPanel.tsx       257 lines   — Chat panel with streaming
HermesNotificationCard.tsx  89 lines  — Notification toast cards
```

### Assets (public/)
```
hermes-owl.webp       ~167 KB   — Animated owl (WebP, 192×128, 12fps, loop)
hermes-owl-static.png  ~18 KB   — Static owl fallback (PNG, 192×128)
```

**Total: 14 files, ~1,435 lines of source code + 2 assets.**
