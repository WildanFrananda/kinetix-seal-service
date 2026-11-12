type HeldRightView = {
  id: string
  role: string
  orderNumber: string
  order: string
  reporterKey: string
  merchantTag: string
  window: number
  deliveredAt: string
  status: "granted" | "pending"
  leafIndex: string | null
  crowd: number
}

export type { HeldRightView }
