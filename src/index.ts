export { PokeServerPlugin as default } from './server.js'

function printStartupBanner(): void {
  const bgMagenta = '\x1b[45m'
  const fgWhite = '\x1b[37m'
  const reset = '\x1b[0m'
  console.log(`${bgMagenta}${fgWhite} ⚡ opencode-poke-plugin loaded ${reset}`)
}

printStartupBanner()
