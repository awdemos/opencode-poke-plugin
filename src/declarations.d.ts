declare module '@opencode-ai/plugin' {
  export interface PluginContext {
    client?: {
      kv?: {
        get?: (key: string) => Promise<unknown>
      }
      emit?: (event: string, data: unknown) => void
    }
    project?: {
      id: string
      config?: Record<string, unknown>
    }
  }

  export interface PluginEvent {
    type: string
    data?: Record<string, unknown>
  }

  export interface PluginHooks {
    event?: (args: { event: PluginEvent }) => Promise<void> | void
    'experimental.chat.messages.transform'?: (
      input: unknown,
      output: { messages: Array<{ info: { role?: string }; parts: Array<{ type: string; text?: string }> }> },
    ) => Promise<void> | void
  }

  export type Plugin = (ctx: PluginContext) => Promise<PluginHooks> | PluginHooks
}
