declare module '@opencode-ai/plugin' {
  // Re-export TUI types from the concrete subpath that the plugin host uses.
  export type { TuiPlugin, TuiPluginModule, TuiPluginApi, TuiPluginMeta } from '@opencode-ai/plugin/dist/tui.js'

  // Minimal mirror of the host's Plugin signature so the server entrypoint
  // can type-check without reaching into the package internals.
  export type PluginInput = {
    client: {
      kv?: {
        get?: (key: string) => Promise<unknown>
        set?: (key: string, value: unknown) => Promise<void>
      }
    }
    project: { id: string; config?: Record<string, unknown> }
    directory: string
    worktree: string
    serverUrl: URL
  }

  export type PluginOptions = Record<string, unknown>

  export interface PluginEvent {
    type: string
    data?: Record<string, unknown>
  }

  export type PluginHooks = {
    event?: (args: { event: PluginEvent }) => Promise<void> | void
    'experimental.chat.messages.transform'?: (
      input: unknown,
      output: { messages: Array<{ info: { role?: string }; parts: Array<{ type: string; text?: string }> }> },
    ) => Promise<void> | void
    [key: string]: unknown
  }

  export type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<PluginHooks> | PluginHooks
}
