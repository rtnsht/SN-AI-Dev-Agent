# Chat Message Queue

## Overview

Users can type and send follow-up messages while the AI is processing a response. Messages are queued client-side and automatically sent sequentially when the current response completes, similar to Claude Chat and Cursor Chat.

---

## How It Works

```
User types message 1 → sent immediately → AI starts processing
  |
  | (input stays enabled)
  |
User types message 2 → queued (shown in chat with "Queued" badge)
User types message 3 → queued (shown in chat with "Queued" badge)
  |
  | AI finishes message 1 response
  |
Message 2 auto-sent → AI starts processing
  |
  | AI finishes message 2 response
  |
Message 3 auto-sent → AI starts processing
  ...
```

### Key Behaviors

- Input (textarea, attach, mic) stays **enabled** while the AI is processing.
- Sending while the AI is working **queues** the message instead of blocking.
- Queued messages appear in the chat immediately with a **"Queued" badge**, dashed border, and muted opacity.
- When the AI finishes, the **next queued message is automatically sent** after a 300ms delay.
- Users can **cancel individual queued messages** via the X button on the badge.
- The **stop button** remains available to abort the current AI request.
- A **queue counter badge** appears on the send button showing how many messages are waiting.
- Queued messages include a temporal context hint (`[This message was typed while the AI was responding]`) so the AI understands the user was reacting to earlier context, not the just-completed response.

### What Does Not Change

- Backend API routes are unchanged; the queue is entirely client-side.
- Message streaming (SSE) is unchanged.
- AbortController / cancel behavior is preserved.
- Internal auto-resume messages (e.g., `max_rounds_reached` continuation) bypass the queue.

---

## Architecture

### State

| State | Location | Purpose |
|-------|----------|---------|
| `messageQueue` | `app/page.tsx` | Array of `QueuedMessage` objects waiting to be sent |
| `message.queued` | `ChatMessage` type | Boolean flag marking a message as queued in the chat UI |

### Types

```typescript
// In webapp/src/lib/types.ts

interface QueuedMessage {
  id: string;
  text: string;
  images?: string[];
  files?: FileAttachment[];
  timestamp: string;
}

interface ChatMessage {
  // ... existing fields ...
  queued?: boolean;  // true = displayed but not yet sent
}
```

### Data Flow

```
page.tsx (state owner)
  |
  |-- messageQueue: QueuedMessage[]
  |-- handleSend: queues when isLoading, sends when not
  |-- drain effect: watches isLoading, auto-sends next queued message
  |-- handleDequeueMessage(id): removes one queued message
  |-- handleClearQueue(): removes all queued messages
  |
  +-> ChatWindow (props)
  |     |-- queueLength: number
  |     |-- onDequeue: (id) => void
  |     |-- onClearQueue: () => void
  |     |-- input enabled during loading
  |     |-- send button shows clock icon + badge when loading
  |
  +-> MessageBubble (via messages array)
        |-- message.queued === true → dashed border, 60% opacity, "Queued" pill, cancel button
        |-- message.queued === false → normal rendering
```

---

## Files Modified

| File | Change |
|------|--------|
| `webapp/src/lib/types.ts` | Added `queued?: boolean` to `ChatMessage`, added `QueuedMessage` interface |
| `webapp/src/app/app/page.tsx` | Added `messageQueue` state, modified `handleSend` to queue when `isLoading`, added drain effect, added `handleDequeueMessage` and `handleClearQueue` callbacks, passed queue props to ChatWindow |
| `webapp/src/components/ChatWindow.tsx` | Enabled textarea/attach/mic during loading, changed placeholder during loading, added clock icon on send button when loading, added queue counter badge, passed `onDequeue` to MessageBubble |
| `webapp/src/components/MessageBubble.tsx` | Added `onDequeue` prop, renders queued messages with dashed border, 60% opacity, "Queued" pill badge, and cancel (X) button |

---

## Implementation Details

### handleSend (page.tsx)

When `isLoading` is true and the message is not an internal auto-resume (`hidden`), the message is queued instead of sent:

1. A `QueuedMessage` object is created with a unique ID.
2. It is pushed to `messageQueue` state.
3. A `ChatMessage` with `queued: true` is added to the messages array so it appears in the chat immediately.
4. The function returns without making an API call.

When `isLoading` is false, the existing send logic runs unchanged.

### Drain Effect (page.tsx)

A `useEffect` watches `isLoading`. When it transitions to `false` and `messageQueue` is non-empty:

1. The first message is popped from the queue.
2. The corresponding `ChatMessage` in the messages array has its `queued` flag set to `false`.
3. After a 300ms delay, `handleSendRef.current` is called with the message text prefixed by the temporal context hint.

### Input Bar (ChatWindow.tsx)

- Textarea: `disabled={!connected}` (no longer disabled during loading).
- Placeholder: "Type to queue a follow-up message..." when loading; "What should we work on next?" otherwise.
- Send button: shows a clock icon when `isLoading` (queue-send mode); shows the normal arrow icon when not loading.
- Stop button and send button are shown **side-by-side** during loading.
- Queue counter badge appears as a small circle on the send button showing the count.

### Queued Message Rendering (MessageBubble.tsx)

When `message.queued === true`:

- Outer container: 60% opacity.
- Border: dashed instead of solid.
- "Queued" pill: blue tint with clock icon, shown below the message text.
- Cancel button: X icon that calls `onDequeue(message.id)` to remove the message from the queue and chat.
- Copy button is hidden for queued messages.

---

## Temporal Context

When a queued message is sent, it is prefixed with:

```
[This message was typed while the AI was responding]

<original message text>
```

This hint helps the AI understand that the user's message refers to earlier conversation context, not the response that was just completed. This addresses a known UX issue where queued messages can be misinterpreted as reactions to the AI's latest output.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User cancels the current AI request (stop button) | `isLoading` becomes false, drain effect fires, next queued message is sent |
| User cancels a queued message | Message removed from `messageQueue` and from the chat UI |
| User starts a new chat while messages are queued | `handleNewChat` clears all state including `messageQueue` |
| AI response triggers auto-resume (max_rounds_reached) | Auto-resume messages have `hidden: true` and bypass the queue |
| Slash commands while loading | Slash commands (e.g., `/spec`, `/help`) are processed immediately, not queued |
| Rate limit (429) during drain | The drained message hits the normal error handling; `pendingRetry` stores it for retry |
