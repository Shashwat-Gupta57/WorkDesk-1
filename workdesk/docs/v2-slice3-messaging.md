# V2 Slice 3 — Internal 1:1 Messaging

## What Was Built

User-to-user private conversations within the organisation. Messages support optional artifact references — a shared card linking directly to an artifact in the archive. Unread counts appear as a badge in the sidebar.

**Migration:** `0010_messaging.sql`
**Commit:** `feat(v2-slice-3): internal 1:1 messaging`

---

## Schema

```sql
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at    TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body            TEXT NOT NULL CHECK (char_length(body) <= 4000),
  artifact_ref_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at       TIMESTAMPTZ,
  search_vector   tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED
);

CREATE INDEX messages_fts_idx ON messages USING GIN (search_vector);
```

---

## Backend

### `messagingService.ts` (`src/modules/messaging/services/`)

| Function | Behaviour |
|---|---|
| `getOrCreateConversation(userA, userB)` | Finds an existing 1:1 conversation by checking for a conversation where `COUNT(members) = 2` and both IDs are members. Creates one in a transaction if none exists. |
| `listConversations(userId)` | Returns all conversations the user is in, ordered by `updated_at DESC`. Includes last message preview and `unread_count` (messages after `last_read_at` sent by the other user). |
| `getConversation(userId, convId, opts)` | Cursor-paginated message list (newest first, reversed to chronological for display). Marks conversation read by updating `last_read_at`. |
| `sendMessage(senderId, convId, body, artifactRefId?)` | Validates sender is a member. Transaction: INSERT message + UPDATE `conversations.updated_at`. Returns message with sender name and optional artifact ref details. |
| `totalUnreadCount(userId)` | Single integer: total unread messages across all conversations. Used by the sidebar badge. |

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/messaging/conversations` | GET | List conversations for calling user |
| `/api/messaging/conversations` | POST | Start conversation (`{ recipientId, body }`) |
| `/api/messaging/conversations/[id]` | GET | Get messages (`?cursor=`, `?limit=`) |
| `/api/messaging/conversations/[id]/messages` | POST | Send message (`{ body, artifactRefId? }`) |
| `/api/messaging/unread` | GET | Returns `{ count: number }` |

---

## Frontend

### `MessagingPage` (`src/app/(app)/messaging/page.tsx`)

Uses `useSearchParams()` for the active conversation URL param (`?c=<id>`), which requires a `<Suspense>` boundary for Next.js 16 static prerendering. The inner component `MessagingInner` is wrapped accordingly.

**ConversationList** (left panel, `w-72`):
- Lists all conversations ordered by most recent message.
- Per-row unread badge when `unread_count > 0`.
- "Compose" button opens the new conversation dialog.
- Clicking a row sets `?c=<id>` in the URL.

**ThreadPane** (right panel):
- Header: other user's name and email.
- Scrollable message list with auto-scroll to bottom on new messages.
- `MessageBubble`: own messages right-aligned (`bg-primary text-white`), others left-aligned (`bg-surface-container`).
- `ArtifactRefCard`: rendered below the message body when `artifactRefId` is present. Clicking navigates to `/archive/[id]`.
- Composer: textarea with Enter-to-send (Shift+Enter for newline).

**Polling:** `useConversations` refetches every 30s. `useConversation` (open thread) refetches every 15s. `useUnreadCount` refetches every 30s.

### `NewConversationDialog` (`src/components/messaging/new-conversation-dialog.tsx`)

- Searchable member list (from `/api/members`).
- Select one recipient → shows selected chip with ✕ to deselect.
- Message body textarea.
- Submit: calls `useStartConversation` which hits `POST /api/messaging/conversations`, then navigates to the new conversation.

### Sidebar

- "Messages" nav entry with live unread count badge.

---

## Manual Test Plan

**Prerequisites:** Two user accounts. Dev server running. Both logged in in separate browsers.

### Start a conversation

1. Log in as **User A** → navigate to **Messages**.
2. Click **Compose** → search for User B by name → select them.
3. Type a message → click Send (or press Enter).
4. The conversation appears in User A's conversation list. The thread pane shows the message.

### Receive a message

5. In User B's browser, navigate to **Messages** (or wait ≤30s for the poll).
6. The conversation from User A appears with an unread badge.
7. The sidebar "Messages" nav item shows a count badge.
8. Click the conversation → the thread opens. The unread badge clears.

### Reply

9. User B types a reply → Send.
10. In User A's thread (wait ≤15s or refresh), the reply appears below the original message.

### Artifact reference

11. User A opens a conversation → types a message → attaches an artifact (artifact picker).
12. The message renders with an `ArtifactRefCard` showing the artifact title and type.
13. User B clicks the card → navigates to the artifact workspace.
14. If the artifact is private and not shared, User B lands on a 404/access-denied page. If it is shared with User B or is PUBLIC, it opens normally.

### Edge cases

| Scenario | Expected |
|---|---|
| Start conversation with self | Not possible — `/api/members` excludes the calling user |
| Send empty message | Button disabled / 400 validation error |
| Message over 4000 characters | 400 — body too long |
| Non-member accesses conversation | 403 — not a member of this conversation |
| Start conversation with same user twice | Returns existing conversation (idempotent) |

---

## Rollback

1. Drop data:
   ```sql
   DELETE FROM messages;
   DELETE FROM conversation_members;
   DELETE FROM conversations;
   ```
2. Drop tables:
   ```sql
   DROP TABLE messages;
   DROP TABLE conversation_members;
   DROP TABLE conversations;
   ```
3. Remove `useUnreadCount` import and call from `src/components/shell/sidebar.tsx`.
4. Remove "Messages" nav entry from sidebar.
5. Remove `/api/messaging/` routes and `src/app/(app)/messaging/page.tsx`.
