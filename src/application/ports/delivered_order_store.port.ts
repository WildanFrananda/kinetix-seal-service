import type { DeliveredOrder } from "../../types/delivered_order.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"

interface DeliveredOrderStorePort {
  cursor(): Promise<LogCursor>
  recordDelivered(from: LogCursor, next: LogCursor, orders: DeliveredOrder[], caughtUp: boolean): Promise<void>
}

export type { DeliveredOrderStorePort }
