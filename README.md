# opencode-poke-plugin

An OpenCode plugin that injects POKE stimuli into the LLM context window.

## What it does

The plugin listens for `@poke x,y` commands in chat and injects a POKE token into the next LLM request:

```
POKE:[2026-05-03T12:34:56Z][42,87][manual]
```

The LLM sees your coordinates and can react to them (e.g., "You poked at (42, 87) — want me to explain what's there?").

## Install

```bash
# Clone into your OpenCode plugins directory
cd ~/.config/opencode/plugins
git clone <repo-url> opencode-poke-plugin

# Build
cd opencode-poke-plugin
npm install
npm run build
```

Add to your `~/.config/opencode/config.yaml`:

```yaml
plugins:
  - id: poke
    source: /path/to/opencode-poke-plugin
```

Restart OpenCode.

## Usage

In any chat message, type:

```
@poke 42,87
```

The plugin will:
1. Parse the coordinates
2. Show a confirmation message: "Poke recorded at (42, 87)"
3. Inject the POKE token into the next LLM context

## Architecture

| File | Responsibility |
|------|---------------|
| `src/server.ts` | Server runtime — handles `@poke` commands, injects into LLM context |
| `src/types.ts` | Shared types and POKE format parser |

### Data flow

```
User types: @poke 42,87
    → server.ts: chat.message event hook
    → Parse coordinates
    → Buffer poke in pending[]

Message transform hook
    → experimental.chat.messages.transform
    → Inject POKE token as synthetic text part
    → Evict oldest if > 8 pokes (context window protection)
    → LLM receives POKE:[timestamp][x,y][session]
```

## Features

- **Context eviction**: Max 8 pokes in flight; oldest evicted first
- **Confirmation message**: Visible feedback when a poke is recorded
- **No dependencies**: Self-contained, ~150 LOC

## POKE Token Format

```
POKE:[ISO-8601-timestamp][x,y][session-id]
```

Example:
```
POKE:[2026-05-03T12:34:56Z][42,87][manual]
```

## Limitations

- **Server-only plugin**: OpenCode 1.14.33 does not support external TUI plugins. Mouse click capture and visual feedback are not available.
- Manual `@poke x,y` command is the only supported input method.

## License

MIT
