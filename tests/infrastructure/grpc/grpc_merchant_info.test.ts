import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { create } from "@bufbuild/protobuf"
import { Metadata, type ServiceError, status } from "@grpc/grpc-js"
import {
  type GetMerchantInfoRequest,
  GetMerchantInfoRequestSchema,
  type GetMerchantInfoResponse,
  GetMerchantInfoResponseSchema,
  MerchantStatus
} from "kinetix-contracts/src/identity/v1/identity_pb.js"

import GrpcMerchantInfo from "../../../src/infrastructure/grpc/grpc_merchant_info.adapter.ts"
import RecordingLogger from "../../fakes/recording_logger.ts"
import { meshIdentityOf, startFeedServer, unaryMethod } from "./feed_test_server.ts"

const seal = meshIdentityOf("seal")
const stops: Array<() => void> = []

const getMerchantInfo = unaryMethod(
  "/identity.v1.IdentityService/GetMerchantInfo",
  GetMerchantInfoRequestSchema,
  GetMerchantInfoResponseSchema
)

function serviceError(code: status, details: string): ServiceError {
  return Object.assign(new Error(details), { code, details, metadata: new Metadata() })
}

after(() => {
  for (const stop of stops) {
    stop()
  }
})

describe("the merchant profile gRPC client", () => {
  it("reads store name and standing from identity over mutual TLS", async () => {
    let seenPrincipal = ""
    const server = await startFeedServer(
      "identity",
      getMerchantInfo,
      (request: GetMerchantInfoRequest): GetMerchantInfoResponse => {
        seenPrincipal = request.principalId

        if (request.principalId === "mrc-missing") {
          return create(GetMerchantInfoResponseSchema, { found: false })
        }

        return create(GetMerchantInfoResponseSchema, {
          found: true,
          merchantPrincipalId: request.principalId,
          storeName: "Warung Nusantara",
          status: MerchantStatus.SUSPENDED
        })
      }
    )

    stops.push(server.stop)

    const client = new GrpcMerchantInfo(server.address, seal, 5, new RecordingLogger())
    stops.push(() => client.close())

    const found = await client.find("mrc-1")
    const missing = await client.find("mrc-missing")

    assert.equal(seenPrincipal, "mrc-missing")
    assert.deepEqual(found, { storeName: "Warung Nusantara", status: "suspended" })
    assert.equal(missing, undefined)
  })

  it("logs a warning and degrades to undefined when identity fails or wears the wrong name", async () => {
    const server = await startFeedServer("identity", getMerchantInfo, () =>
      serviceError(status.UNAVAILABLE, "identity is restarting")
    )

    stops.push(server.stop)

    const logger = new RecordingLogger()
    const client = new GrpcMerchantInfo(server.address, seal, 5, logger)
    stops.push(() => client.close())

    const result = await client.find("mrc-1")

    assert.equal(result, undefined)
    assert.equal(logger.lines.length, 1)
    assert.equal(logger.lines[0]?.message, "identity's merchant profile could not be read")
  })
})
