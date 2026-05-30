# 🏛️ Hermes Agent — Integration Guide

> **A plug-and-play AI accounting consultant overlay for multi-tenant Danish accounting apps.**
> Hermes floats above your app as an ethereal, always-available assistant that knows Danish
> regnskabspraksis (accounting practices), SKAT deadlines, and your tenant's private financial data.

---

## 📁 Architecture Overview

```
Your Next.js App                           Hermes Mini-Service (port 3004)
┌──────────────────────────────┐           ┌──────────────────────────┐
│  layout.tsx / page.tsx       │           │  index.ts                │
│  ┌─────────────────────────┐ │  Socket   │  ┌────────────────────┐ │
│  │  <HermesOverlay />      │◄├──────────►│  │ TenantProvider     │ │
│  │   ├── FAB (summon btn)   │ │  .IO     │  │ ┌────────────────┐ │ │
│  │   ├── Chat Panel         │ │           │  │ │ MockTenant     │ │ │
│  │   └── Notification Cards │ │           │  │ │ Provider        │ │ │
│  └─────────────────────────┘ │           │  │ └────────────────┘ │ │
│                               │           │  │ ┌────────────────┐ │ │
│  Your existing app content     │           │  │ │ YourDatabase   │ │ │
│  (completely untouched)        │           │  │ │ TenantProvider │ │ │
│                               │           │  │ │ (swap in later) │ │ │
└──────────────────────────────┘           │  │ └────────────────┘ │ │
                                            │  └────────────────────┘ │
                                            │  ┌────────────────────┐ │
                                            │  │ z-ai-web-dev-sdk   │ │
                                            │  │ (LLM for chat)     │ │
                                            │  └────────────────────┘ │
                                            │  ┌────────────────────┐ │
                                            │  │ knowledge-base.ts   │ │
                                            │  │ (Danish accounting) │ │
                                            │  └────────────────────┘ │
                                            └──────────────────────────┘
```

### Two parts, one add-on:

| Part | Location | What it does |
|------|----------|-------------|
| **Backend** | `mini-services/hermes-agent/` | Socket.IO server + LLM + Danish accounting knowledge base. Runs on its own port. |
| **Frontend** | `src/components/hermes/` | React overlay components (FAB, chat panel, notification cards). Drops into any Next.js layout. |

---

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Next.js 14+ (with App Router)
- Tailwind CSS
- `socket.io-client` npm package
- A reverse proxy (like Caddy) that supports `XTransformPort` query routing — OR direct access to multiple ports

### Step 1: Copy Backend Files

Copy the entire `mini-services/hermes-agent/` directory into your project:

```bash
cp -r hermes-addon/mini-services/hermes-agent/ your-project/mini-services/hermes-agent/
```

The directory contains:

```
mini-services/hermes-agent/
├── package.json              # Dependencies: socket.io, z-ai-web-dev-sdk
├── index.ts                  # Socket.IO server entry point
├── config.ts                 # All settings in one place
├── knowledge-base.ts        # Danish accounting knowledge (editable)
├── tenant-provider.ts        # Tenant data interface + mock provider
└── utils.ts                  # Text chunking + tenant context builder
```

Install its dependencies:

```bash
cd mini-services/hermes-agent
bun install   # or: npm install
```

### Step 2: Copy Frontend Components

Copy the `src/components/hermes/` directory into your project:

```bash
cp -r hermes-addon/src/components/hermes/ your-project/src/components/hermes/
```

The directory contains:

```
src/components/hermes/
├── index.ts                  # Barrel export (import from here)
├── types.ts                  # TypeScript interfaces
├── HermesOverlay.tsx          # Main orchestrator (one-line install)
├── HermesFab.tsx             # Floating action button
├── HermesPanel.tsx           # Chat panel with streaming
├── HermesNotificationCard.tsx # Notification toast cards
└── useHermesSocket.ts        # Socket.IO connection hook
```

Install the frontend dependency:

```bash
cd your-project
bun add socket.io-client   # or: npm install socket.io-client
```

> **Note:** Your project also needs `framer-motion`, `react-markdown`, `lucide-react`, and `@radix-ui/react-scroll-area`. If you use shadcn/ui, most of these are already present.

### Step 3: Add the Overlay to Your App

In your **root layout** (`src/app/layout.tsx`) or any page, add:

```tsx
import { HermesOverlay } from '@/components/hermes'

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <body>
        {children}

        {/* Hermes — add this single line */}
        <HermesOverlay />
      </body>
    </html>
  )
}
```

That's it. The overlay floats above everything else.

### Step 4: Start Both Services

```bash
# Terminal 1: Start Hermes backend
cd mini-services/hermes-agent
bun run dev
# → [Hermes] 🏛️  Hermes Agent service running on port 3004

# Terminal 2: Start your Next.js app as usual
cd your-project
bun run dev
# → ✓ Ready on http://localhost:3000
```

### Step 5: Open Your App

You'll see:
- An **amber floating button** (bottom-right) — click it to open the chat
- **Notification cards** that fade in from the top-right with reminders
- A **glassmorphism chat panel** that slides up when you click the FAB

---

## ⚙️ Configuration

### Frontend Props

`HermesOverlay` accepts these optional props:

```tsx
<HermesOverlay
  tenantId="your-tenant-id"        // Required for real use. Default: "alphaflow-aps" (demo)
  userId="user-42"                  // Current user's ID
  userName="Mikkel Andersen"         // Display name
  servicePort={3004}                // Port of Hermes backend. Default: 3004
  agentName="Hermes"                // Display name. Default: "Hermes"
  maxVisibleNotifications={3}       // Max toast cards visible. Default: 3
  greeting="Hej! Hvordan kan jeg…"  // Custom welcome message
  visible={true}                    // Show/hide the entire overlay
/>
```

**Integration with authentication:**

```tsx
// In a server component or with NextAuth:
import { getServerSession } from 'next-auth'
import { HermesOverlay } from '@/components/hermes'

export default async function DashboardPage() {
  const session = await getServerSession()

  return (
    <main>
      {/* Your page content */}

      {session?.user && (
        <HermesOverlay
          tenantId={session.user.tenantId}
          userId={session.user.id}
          userName={session.user.name}
        />
      )}
    </main>
  )
}
```

### Backend Config

Edit `mini-services/hermes-agent/config.ts`:

```typescript
export const defaultConfig: HermesConfig = {
  port: 3004,                       // Change if needed
  agentName: 'Hermes',
  defaultLanguage: 'da',            // "da" = Danish, "en" = English
  maxConversationHistory: 20,       // How many messages to keep in context
  streamingChunkSize: 20,           // Characters per streaming chunk
  streamingChunkDelay: 30,          // Milliseconds between chunks
  reminderCheckInterval: 60_000,    // Check for due reminders every 60s
  reminderWindowDays: 7,            // Proactively notify for items due within 7 days
  corsOrigin: '*',                  // Lock down in production
}
```

### Customizing the Knowledge Base

Edit `mini-services/hermes-agent/knowledge-base.ts`. This is where the Danish
accounting knowledge lives. You can add, remove, or modify any topic.

```typescript
export const DANISH_ACCOUNTING_KNOWLEDGE = `
You are Hermes, the AI accounting consultant…
Your knowledge includes:
- Danish Financial Statements Act (Årsregnskabsloven)
- VAT rules and reporting (Moms) …
- Corporate tax (Selskabsskat) …
// ADD YOUR OWN TOPICS HERE
`
```

---

## 🔌 Connecting Your Real Database

The add-on uses a **TenantProvider pattern**. The mock provider is the default;
you swap it for a real database provider when ready.

### Step 1: Implement `TenantProvider`

Create a new file `mini-services/hermes-agent/database-tenant-provider.ts`:

```typescript
import type { TenantProvider, TenantData, AgentNotification, ConversationMessage } from './tenant-provider'
// import { db } from '../path-to-your-prisma-client'

export class DatabaseTenantProvider implements TenantProvider {
  // ─── Fetch tenant with all related data ───
  async getTenant(tenantId: string): Promise<TenantData | null> {
    // Example with Prisma:
    // const tenant = await db.tenant.findUnique({
    //   where: { id: tenantId },
    //   include: { members: true, agent: true, reminders: true }
    // })
    // if (!tenant) return null
    // return mapToTenantData(tenant)
    return null // implement
  }

  // ─── Agent enable/disable ───
  isAgentEnabled(tenantId: string): boolean {
    // Check your database for the agent config
    return true
  }

  setAgentEnabled(tenantId: string, enabled: boolean): void {
    // db.hermesAgent.upsert({ where: { tenantId }, data: { enabled } })
  }

  // ─── Reminders ───
  getReminders(tenantId: string): AgentNotification[] {
    // db.agentReminder.findMany({ where: { agent: { tenantId }, dismissed: false } })
    return []
  }

  dismissReminder(tenantId: string, reminderId: string): void {
    // db.agentReminder.update({ where: { id: reminderId }, data: { dismissed: true } })
  }

  // ─── Conversation history ───
  getConversationHistory(tenantId: string): ConversationMessage[] {
    // db.agentMessage.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
    return []
  }

  addMessage(tenantId: string, message: ConversationMessage): void {
    // db.agentMessage.create({ data: { tenantId, role: message.role, content: message.content } })
  }
}
```

### Step 2: Swap Provider in index.ts

At the top of `mini-services/hermes-agent/index.ts`, change ONE line:

```typescript
// BEFORE (mock):
const tenantProvider = new MockTenantProvider()

// AFTER (your database):
import { DatabaseTenantProvider } from './database-tenant-provider'
const tenantProvider = new DatabaseTenantProvider()
```

That's it. Everything else works the same.

### Suggested Prisma Schema

Add these models to your existing Prisma schema:

```prisma
model HermesAgent {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  enabled     Boolean  @default(false)
  personality String   @default("professional")
  systemPrompt String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AgentReminder {
  id          String   @id @default(cuid())
  agentId     String
  title       String
  description String?
  dueDate     DateTime?
  status      String   @default("pending")
  createdAt   DateTime @default(now())
}

model AgentMessage {
  id        String   @id @default(cuid())
  agentId   String
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
}
```

---

## 🔀 Caddy / Reverse Proxy Setup

If you use a Caddy gateway (like this project does), the frontend already
connects via `XTransformPort` routing:

```typescript
// Frontend connects to:
io('/?XTransformPort=3004')

// Caddyfile routes :81 traffic to port 3004 when XTransformPort=3004 is in the query
```

If you're **not** using Caddy and both services are accessible, update
`useHermesSocket.ts` to use a direct URL:

```typescript
// Change from:
const socket = io(`/?XTransformPort=${options.servicePort}`, { ... })

// To:
const socket =.io(`http://localhost:${options.servicePort}`, {
  transports: ['websocket', 'polling'],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
})
```

### Nginx Example

```nginx
# Hermes Agent WebSocket
location /hermes/ {
  proxy_pass http://127.0.0.1:3004/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

Then connect: `io('/hermes/?XTransformPort=3004')`

---

## 📡 Socket.IO Event Reference

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join` | Client → Server | `{ tenantId, userId, userName }` | Register a socket for a tenant |
| `join-ack` | Server → Client | `{ status, agentEnabled, tenantName }` | Join confirmation |
| `agent-welcome` | Server → Client | `{ message, tenantName }` | Welcome message |
| `agent-status` | Server → Client | `{ agentEnabled, changedBy }` | Agent toggled on/off |
| `chat` | Client → Server | `{ tenantId, message }` | User sends a message |
| `chat-typing` | Server → Client | `{ typing: true }` | Agent is processing |
| `chat-response` | Server → Client | `{ chunk, done: false }` | Streaming text chunk |
| `chat-complete` | Server → Client | `{ fullResponse, done: true }` | Full response done |
| `chat-error` | Server → Client | `{ error: string }` | Error occurred |
| `toggle-agent` | Client → Server | `{ tenantId, enabled }` | Enable/disable agent |
| `notifications` | Server → Client | `Notification[]` | Batch of pending notifications |
| `notification` | Server → Client | `Notification` | Proactive single notification |
| `dismiss-notification` | Client → Server | `{ notificationId }` | Dismiss a notification |
| `notification-dismissed` | Server → Client | `{ notificationId }` | Dismissal confirmed |

---

## 🎨 Customizing the Look

### Colors
The overlay uses **amber/gold** by default. To change the theme:

1. **FAB button**: Edit `HermesFab.tsx` — change the gradient colors in the `style` prop
2. **Chat panel**: Edit `HermesPanel.tsx` — change `amber-*` classes to your palette
3. **Notifications**: Edit `HermesNotificationCard.tsx` — change `amber-*` classes

### Position
- FAB: `fixed bottom-6 right-6` → change `bottom-6`/`right-6` to reposition
- Panel: `fixed bottom-24 right-6` → adjust to match FAB position
- Notifications: `fixed top-6 right-6` → adjust to taste

### Size
- Panel width: `md:w-[380px]` → change to desired width
- Panel height: `md:h-[520px]` → change to desired height

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| FAB appears but "Ikke forbundet" | Hermes mini-service is not running. Start it: `cd mini-services/hermes-agent && bun run dev` |
| Panel opens but no welcome message | Check `tenantId` matches a known tenant in the provider |
| Chat responses are in English | Check `defaultLanguage` in `config.ts` and the language instruction in `knowledge-base.ts` |
| CORS errors | Set `corsOrigin` in `config.ts` to your app's origin |
| Port conflict | Change `port` in `config.ts` and update `servicePort` prop on `<HermesOverlay />` |
| Messages not streaming | Check browser console for WebSocket errors. Ensure your proxy supports WebSocket upgrade |

---

## 📂 File Checklist

### Backend (copy to `mini-services/hermes-agent/`)

```
✅ package.json
✅ index.ts          — Server entry point
✅ config.ts         — All configuration
✅ knowledge-base.ts — Danish accounting knowledge
✅ tenant-provider.ts — TenantProvider interface + MockTenantProvider
✅ utils.ts          — Helpers
```

### Frontend (copy to `src/components/hermes/`)

```
✅ index.ts                  — Barrel export
✅ types.ts                  — TypeScript interfaces
✅ HermesOverlay.tsx          — Main component
✅ HermesFab.tsx             — Summon button
✅ HermesPanel.tsx           — Chat panel
✅ HermesNotificationCard.tsx — Toast notifications
✅ useHermesSocket.ts        — Socket hook
```

### Dependencies

```
Backend:  socket.io, z-ai-web-dev-sdk
Frontend: socket.io-client, framer-motion, react-markdown, lucide-react
```

---

## 🧭 Roadmap for Expansion

- **Real database**: Swap `MockTenantProvider` → `DatabaseTenantProvider` (see above)
- **Authentication**: Pass JWT/session data through the `join` event for auth validation
- **Conversation persistence**: Store conversations in DB with `AgentMessage` table
- **Proactive scheduling**: Add a cron system for deadline reminders (moms, årsrapport, løn)
- **Multi-language**: Extend `knowledge-base.ts` with English/German accounting topics
- **Action buttons**: Let Hermes suggest actions (e.g. "Opret faktura", "Indberet moms") that link to your app routes
- **File uploads**: Let users upload bilag (vouchers) for Hermes to analyze
- **Admin dashboard**: A settings page to configure agent personality, custom prompts, and toggle per-tenant
