import type { LoggerPort } from "../../application/ports/logger.port.ts"
import type { LogEvent } from "../../types/log_event.type.ts"
import type { LogLevel } from "../../types/log_level.type.ts"

const severity: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const reserved = new Set(["timestamp", "level", "message", "logger", "request_id", "stack"])

class JsonLogger implements LoggerPort {
  private readonly name: string
  private readonly threshold: number
  private readonly write: (line: string) => void

  constructor(name: string, level: LogLevel, write: (line: string) => void) {
    this.name = name
    this.threshold = severity[level]
    this.write = write
  }

  debug(event: LogEvent): void {
    this.emit("debug", event, undefined)
  }

  info(event: LogEvent): void {
    this.emit("info", event, undefined)
  }

  warn(event: LogEvent): void {
    this.emit("warn", event, undefined)
  }

  error(event: LogEvent, error?: unknown): void {
    this.emit("error", event, error)
  }

  private emit(level: LogLevel, event: LogEvent, error: unknown): void {
    if (severity[level] < this.threshold) {
      return
    }

    const line: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message: event.message,
      logger: this.name
    }

    if (event.requestId !== undefined) {
      line.request_id = event.requestId
    }

    for (const [key, value] of Object.entries(event.fields ?? {})) {
      line[reserved.has(key) ? `field_${key}` : key] = value
    }

    if (error instanceof Error) {
      line.error = error.message
      line.stack = error.stack
    } else if (error !== undefined) {
      line.error = String(error)
    }

    this.write(
      `${JSON.stringify(line, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value))}\n`
    )
  }
}

export default JsonLogger
