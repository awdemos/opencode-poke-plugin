# opencode-poke-plugin

A minimal OpenCode plugin that lets you **poke** the AI by clicking in the TUI — injecting click coordinates into the LLM context window.

## What it does

1. **Captures mouse clicks** in the OpenCode TUI (`mouse:click` event)
2. **Shows a visual ripple** at the click location (200 ms, non-blocking)
3. **Injects a POKE token** into the next LLM request:
   ```
   POKE:[2026-05-03T12:34:56Z][42,87][a1b2-c3d4-...]
   ```

The LLM sees your click coordinates and can react to them (e.g., "You clicked near the file explorer — want me to open that folder?").

## Install

```bash
# Clone into your OpenCode plugins directory
cd ~/.config/opencode/plugins
git clone <repo-url> opencode-poke-plugin

# Or symlink for development
cd /var/home/a/code/opencode-poke-plugin
npm link
```

Add to your `~/.config/opencode/config.yaml`:

```yaml
plugins:
  - id: poke
    source: /path/to/opencode-poke-plugin
```

Restart OpenCode. Click anywhere in the TUI — you'll see a green ripple and the next AI response will acknowledge your poke.

## Architecture

### Dual entrypoints (target-exclusive)

OpenCode v1 plugins must export separate `./tui` and `./server` targets:

| File | Target | Responsibility |
|------|--------|---------------|
| `src/tui.ts` | TUI runtime | Capture clicks, render ripples, buffer to KV |
| `src/server.ts` | Server runtime | Read KV buffer, inject into LLM context |
| `src/types.ts` | Shared | Types, POKE format, ring buffer, utilities |

### Data flow

```
User clicks in TUI
    → tui.ts: mouse:click handler
    → Normalize coords (0-100 scale)
    → Render ripple overlay (Solid.js slot)
    → Buffer poke → KV store (poke:buffer:v1)
    → Emit poke:flush event

Server event hook
    → Receive poke:flush
    → Pull from KV
    → Queue in pending[]

Message transform hook
    → experimental.chat.messages.transform
    → Inject POKE tokens as synthetic text part
    → Evict oldest if > 8 pokes (context window protection)
    → LLM receives POKE:[timestamp][x,y][session]
```

## Features

- **Idempotent**: Same session ID across reloads; duplicate pokes deduplicated by timestamp
- **Throttled**: 10 FPS max (100 ms); rapid clicks queued, not dropped
- **Context eviction**: Max 8 pokes in flight; oldest evicted first
- **Silent failures**: Overlay never throws; KV errors swallowed gracefully
- **No dependencies**: Self-contained, ~350 LOC

## POKE Token Format

```
POKE:[ISO-8601-timestamp][normalized-x,normalized-y][session-uuid]
```

Example:
```
POKE:[2026-05-03T12:34:56Z][42,87][a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab]
```

- Coordinates normalized to 0–100 viewport scale (works across different terminal sizes)
- Session ID persists across plugin reloads via KV store

## Demo

```
┌─────────────────────────────────────────────┐
│  OpenCode TUI                               │
│                                             │
│  > @poke                                    │
│                                             │
│  [User clicks at screen position (42, 87)]  │
│       💚 ripple expands... fades            │
│                                             │
│  AI: "You poked near the file explorer.     │
│      Want me to list the directory?"        │
└─────────────────────────────────────────────┘
```

The green `█` ripple renders for 200 ms at the click coordinates. The POKE token is injected into the next chat turn automatically — no manual `@poke` command needed (though `@poke x,y` is also supported as a fallback).

## Testing

No external test runner — the plugin is small enough to verify manually:

1. **Click detection**: Click in TUI → verify green ripple appears
2. **Throttling**: Rapid-click 10x → verify only ~1 poke/100 ms buffered
3. **Context injection**: Send a message after clicking → inspect debug logs for POKE token in LLM context
4. **Eviction**: Click 20 times → verify only 8 most recent pokes appear in context
5. **Idempotency**: Reload plugin → verify same session ID in KV

```bash
# Watch the KV buffer in real-time (development)
opencode kv get poke:buffer:v1
opencode kv get poke:session:v1
```

## Manual @poke fallback

If the TUI mouse API is unavailable, you can still inject pokes manually:

```
@poke 42,87
```

This creates a POKE token with coordinates (42, 87) and session ID "manual".

## License

MIT
