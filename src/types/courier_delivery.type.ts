import type { LogCursor } from "./log_cursor.type.ts"

type CourierDelivery = {
  position: LogCursor
  orderNumber: string
  driverPrincipalId: string
  deliveredAt: Date
}

export type { CourierDelivery }
