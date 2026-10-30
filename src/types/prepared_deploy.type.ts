import type { DeployReceipt } from "./deploy_receipt.type.ts"

type PreparedDeploy = {
  contractAddress: string
  submit(): Promise<DeployReceipt>
}

export type { PreparedDeploy }
