type LogEvent = {
  message: string
  requestId?: string
  fields?: Record<string, unknown>
}

export type { LogEvent }
