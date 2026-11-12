import type { DeliveredOrder } from "./delivered_order.type.ts"
import type { LogCursor } from "./log_cursor.type.ts"

type OrderLifecycleRecord = {
  position: LogCursor
  delivery: DeliveredOrder | undefined
}

export type { OrderLifecycleRecord }
