import type { MerchantInfoPort } from "../../src/application/ports/merchant_info.port.ts"
import type { MerchantInfo } from "../../src/types/merchant_info.type.ts"

class FakeMerchantInfo implements MerchantInfoPort {
  readonly profiles = new Map<string, MerchantInfo>()

  async find(principalId: string): Promise<MerchantInfo | undefined> {
    return this.profiles.get(principalId)
  }
}

export default FakeMerchantInfo
