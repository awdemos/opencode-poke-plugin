export interface PokeCoords {
  x: number
  y: number
}

export interface PokeData {
  timestamp: string
  coords: PokeCoords
  sessionId: string
}

export interface MouseClickEvent {
  x: number
  y: number
}

export class PokeBuffer {
  private readonly items: PokeData[] = []
  constructor(private readonly capacity: number) {}

  push(p: PokeData): boolean {
    if (this.items.length >= this.capacity) this.items.shift()
    this.items.push(p)
    return true
  }

  drain(): PokeData[] {
    const out = this.items.slice()
    this.items.length = 0
    return out
  }

  get length(): number {
    return this.items.length
  }
}

export function formatPoke(p: PokeData): string {
  return `POKE:[${p.timestamp}][${p.coords.x},${p.coords.y}][${p.sessionId}]`
}

export function parsePoke(raw: string): PokeData | null {
  const m = raw.match(/^POKE:\[([^\]]+)\]\[(\d+),(\d+)\]\[([^\]]+)\]$/)
  if (!m) return null
  return {
    timestamp: m[1],
    coords: { x: parseInt(m[2], 10), y: parseInt(m[3], 10) },
    sessionId: m[4],
  }
}

/** Lightweight UUID-v4 generator (no crypto import needed). */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function normalizeCoord(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)))
}

export function nowISO(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export const POKE_KV_KEY = 'poke:buffer:v1'
export const SESSION_KV_KEY = 'poke:session:v1'
