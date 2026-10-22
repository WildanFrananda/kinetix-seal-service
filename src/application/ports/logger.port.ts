import type { LogEvent } from "../../types/log_event.type.ts"

interface LoggerPort {
  debug(event: LogEvent): void
  info(event: LogEvent): void
  warn(event: LogEvent): void
  error(event: LogEvent, error?: unknown): void
}

export type { LoggerPort }
