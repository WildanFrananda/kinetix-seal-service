import type { LoggerPort } from "../../src/application/ports/logger.port.ts"
import type { LogEvent } from "../../src/types/log_event.type.ts"

class RecordingLogger implements LoggerPort {
  readonly lines: LogEvent[] = []

  debug(event: LogEvent): void {
    this.lines.push(event)
  }

  info(event: LogEvent): void {
    this.lines.push(event)
  }

  warn(event: LogEvent): void {
    this.lines.push(event)
  }

  error(event: LogEvent): void {
    this.lines.push(event)
  }
}

export default RecordingLogger
