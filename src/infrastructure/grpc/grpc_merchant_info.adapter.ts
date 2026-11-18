import { create } from "@bufbuild/protobuf"
import type { Client } from "@grpc/grpc-js"
import {
  GetMerchantInfoRequestSchema,
  IdentityService,
  MerchantStatus
} from "kinetix-contracts/src/identity/v1/identity_pb.js"

import type { LoggerPort } from "../../application/ports/logger.port.ts"
import type { MerchantInfoPort } from "../../application/ports/merchant_info.port.ts"
import type { MerchantInfo } from "../../types/merchant_info.type.ts"
import type { MerchantStanding } from "../../types/merchant_standing.type.ts"
import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import { meshGrpcClient } from "./mesh_grpc_client.ts"
import { unaryCall } from "./unary_call.ts"

const peer = "identity"

class GrpcMerchantInfo implements MerchantInfoPort {
  private readonly client: Client
  private readonly timeoutSeconds: number
  private readonly logger: LoggerPort

  constructor(address: string, identity: MeshIdentity, timeoutSeconds: number, logger: LoggerPort) {
    this.client = meshGrpcClient(address, identity, peer)
    this.timeoutSeconds = timeoutSeconds
    this.logger = logger
  }

  async find(principalId: string): Promise<MerchantInfo | undefined> {
    try {
      const response = await unaryCall(
        this.client,
        IdentityService.method.getMerchantInfo,
        create(GetMerchantInfoRequestSchema, { principalId }),
        this.timeoutSeconds
      )

      if (!response.found) {
        return undefined
      }

      return {
        storeName: response.storeName === "" ? null : response.storeName,
        status: this.standingOf(response.status)
      }
    } catch (error) {
      this.logger.warn({
        message: "identity's merchant profile could not be read",
        fields: { merchant_principal_id: principalId, cause: error instanceof Error ? error.message : String(error) }
      })

      return undefined
    }
  }

  close(): void {
    this.client.close()
  }

  private standingOf(status: MerchantStatus): MerchantStanding | null {
    switch (status) {
      case MerchantStatus.PENDING:
        return "pending"
      case MerchantStatus.VERIFIED:
        return "verified"
      case MerchantStatus.SUSPENDED:
        return "suspended"
      case MerchantStatus.CLOSED:
        return "closed"
      default:
        return null
    }
  }
}

export default GrpcMerchantInfo
