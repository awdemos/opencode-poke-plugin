/**
 * TUI plugin — captures mouse clicks, renders ripples, and buffers poke data.
 *
 * Exported as the `./tui` entrypoint.  Must remain target-exclusive (no `server` export).
 */

/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from '@opencode-ai/plugin/tui'
import { createSignal } from '@opentui/solid'
import {
  uuidv4,
  nowISO,
  normalizeCoord,
  formatPoke,
  PokeBuffer,
  POKE_KV_KEY,
  SESSION_KV_KEY,
  type MouseClickEvent,
  type PokeData,
} from './types.js'

const RIPPLE_MS = 200
const RIPPLE_COLOR = '#00ff88'
const THROTTLE_MS = 100
const BUFFER_MAX = 3
const OPACITY_START = 0.6

interface Ripple {
  id: number
  x: number
  y: number
  born: number
}

let rippleId = 0

const tui: TuiPlugin = async (api, _options, meta) => {
  let sessionId = await api.kv.get(SESSION_KV_KEY).catch(() => null)
  if (typeof sessionId !== 'string' || meta.state === 'first') {
    sessionId = uuidv4()
    await api.kv.set(SESSION_KV_KEY, sessionId)
  }

  const [ripples, setRipples] = createSignal<Ripple[]>([])
  const buffer = new PokeBuffer(BUFFER_MAX)
  let lastClick = 0
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  function spawnRipple(x: number, y: number) {
    const id = ++rippleId
    const r: Ripple = { id, x, y, born: Date.now() }
    setRipples((prev) => [...prev, r])
    setTimeout(() => {
      setRipples((prev) => prev.filter((ri) => ri.id !== id))
    }, RIPPLE_MS)
  }

  function makePoke(ex: MouseClickEvent): PokeData {
    const size = api.renderer?.size ?? { width: 100, height: 100 }
    return {
      timestamp: nowISO(),
      coords: {
        x: normalizeCoord(ex.x, size.width),
        y: normalizeCoord(ex.y, size.height),
      },
      sessionId: sessionId as string,
    }
  }

  async function flush() {
    if (buffer.length === 0) return
    const batch = buffer.drain().map(formatPoke)
    try {
      await api.kv.set(POKE_KV_KEY, JSON.stringify(batch))
    } catch {}
    try {
      // @ts-expect-error — client shape is runtime-dependent
      api.client?.emit?.('poke:flush', { count: batch.length })
    } catch {}
  }

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
    }, THROTTLE_MS)
  }

  const unsubMouse = api.event.on('mouse:click', (evt: MouseClickEvent) => {
    const now = Date.now()

    const size = api.renderer?.size ?? { width: 100, height: 100 }
    if (evt.x < 0 || evt.y < 0 || evt.x > size.width || evt.y > size.height) {
      return
    }

    if (now - lastClick < THROTTLE_MS) {
      buffer.push(makePoke(evt))
      scheduleFlush()
      return
    }
    lastClick = now

    spawnRipple(evt.x, evt.y)
    buffer.push(makePoke(evt))
    flush()
  })

  api.slots.register(() => {
    const items = ripples()
    if (items.length === 0) return null

    return (
      <box
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {items.map((r) => {
          const age = Date.now() - r.born
          const progress = Math.min(1, age / RIPPLE_MS)
          const radius = Math.max(1, Math.floor(progress * 4))
          const opacity = OPACITY_START * (1 - progress)

          return (
            <box
              key={r.id}
              style={{
                position: 'absolute',
                left: Math.max(0, r.x - radius),
                top: Math.max(0, r.y - radius),
                width: radius * 2 + 1,
                height: radius * 2 + 1,
              }}
            >
              <text style={{ color: RIPPLE_COLOR, opacity }}>
                {'█'.repeat(Math.max(1, radius * 2 + 1))}
              </text>
            </box>
          )
        })}
      </box>
    )
  })

  api.lifecycle.onDispose(() => {
    unsubMouse()
    if (flushTimer) clearTimeout(flushTimer)
    flush()
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: 'poke',
  tui,
}

export default plugin
