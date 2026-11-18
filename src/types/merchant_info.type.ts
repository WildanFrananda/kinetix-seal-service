import type { MerchantStanding } from "./merchant_standing.type.ts"

type MerchantInfo = {
  storeName: string | null
  status: MerchantStanding | null
}

export type { MerchantInfo }
