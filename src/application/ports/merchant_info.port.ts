import type { MerchantInfo } from "../../types/merchant_info.type.ts"

interface MerchantInfoPort {
  find(principalId: string): Promise<MerchantInfo | undefined>
}

export type { MerchantInfoPort }
