/**
 * Server plugin — injects buffered POKE tokens into the LLM context window.
 *
 * Exported as the `./server` entrypoint.  Must remain target-exclusive (no `tui` export).
 */

import type { Plugin } from '@opencode-ai/plugin'
import { parsePoke, POKE_KV_KEY, type PokeData } from './types.js'

const POKE_MAX = 8
const POKE_TAG = '<poke>'
const POKE_CLOSE = '</poke>'

function isPokePart(text: string): boolean {
  return text.startsWith(POKE_TAG) && text.endsWith(POKE_CLOSE)
}

function extractPokes(text: string): string[] {
  const inner = text.slice(POKE_TAG.length, -POKE_CLOSE.length)
  return inner.split('\n').filter((l) => l.trim().startsWith('POKE:'))
}

function buildPokePart(pokes: PokeData[]): string {
  const lines = pokes.map((p) => `POKE:[${p.timestamp}][${p.coords.x},${p.coords.y}][${p.sessionId}]`)
  return `${POKE_TAG}\n${lines.join('\n')}\n${POKE_CLOSE}`
}

interface MessagePart {
  type: string
  text?: string
  [k: string]: unknown
}

interface MessageWithParts {
  info: { role?: string; [k: string]: unknown }
  parts: MessagePart[]
}

interface TransformOutput {
  messages: MessageWithParts[]
}

export const PokeServerPlugin: Plugin = async (ctx) => {
  const pending: PokeData[] = []

  try {
    const raw = await ctx.client?.kv?.get?.(POKE_KV_KEY)
    if (typeof raw === 'string') {
      const lines: string[] = JSON.parse(raw)
      for (const line of lines) {
        const parsed = parsePoke(line)
        if (parsed) pending.push(parsed)
      }
    }
  } catch {}

  return {
    'chat.message': async (
      _input: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string }; messageID?: string; variant?: string },
      output: { message: { content?: string }; parts: Array<{ type: string; text?: string }> }
    ) => {
      const content = output.parts.filter((p) => p.type === 'text').map((p) => p.text || '').join('')

      if (content.trim() === '@poke') {
        output.parts.push({
          type: 'text',
          text: 'Usage: @poke x,y — e.g., @poke 100,200',
        })
        return
      }

      const match = content.match(/^@poke\s+(\d+),(\d+)\s*(.*)/)
      if (match) {
        const x = parseInt(match[1], 10)
        const y = parseInt(match[2], 10)
        const sessionId = match[3] || 'manual'
        pending.push({
          timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          coords: { x, y },
          sessionId,
        })
        output.parts.push({
          type: 'text',
          text: `Poke recorded at (${x}, ${y})`,
        })
      }
    },

    'experimental.chat.messages.transform': async (_input, output: TransformOutput) => {
      if (!output.messages || output.messages.length === 0) return

      const pokesToInject = pending.splice(0, pending.length)
      if (pokesToInject.length === 0) return

      let existingPokeCount = 0
      for (const m of output.messages) {
        for (const p of m.parts) {
          if (p.type === 'text' && p.text && isPokePart(p.text)) {
            existingPokeCount += extractPokes(p.text).length
          }
        }
      }

      let total = existingPokeCount + pokesToInject.length
      if (total > POKE_MAX) {
        const toEvict = total - POKE_MAX
        let evicted = 0
        for (const m of output.messages) {
          if (evicted >= toEvict) break
          m.parts = m.parts.filter((p) => {
            if (evicted >= toEvict) return true
            if (p.type === 'text' && p.text && isPokePart(p.text)) {
              evicted++
              return false
            }
            return true
          })
        }
      }

      const targetIndex = output.messages.findLastIndex((m) => m.info.role === 'user')
      const insertIdx = targetIndex >= 0 ? targetIndex : output.messages.length - 1
      const targetMsg = output.messages[insertIdx]

      const pokePart: MessagePart = {
        type: 'text',
        text: buildPokePart(pokesToInject),
      }

      targetMsg.parts.push(pokePart)
    },
  }
}

export default PokeServerPlugin
