import type { CaseStorePort } from "../application/ports/case_store.port.ts"
import type { MerchantInfoPort } from "../application/ports/merchant_info.port.ts"

type CaseCatalogueDependencies = {
  cases: CaseStorePort
  merchants: MerchantInfoPort
  issuerSecret: Uint8Array
}

export type { CaseCatalogueDependencies }
