import { readFileSync } from "node:fs"
import { type DescMessage, fromBinary, type MessageShape, toBinary } from "@bufbuild/protobuf"
import {
  type MethodDefinition,
  Server,
  ServerCredentials,
  type ServerUnaryCall,
  type ServiceError,
  type sendUnaryData
} from "@grpc/grpc-js"

import type { MeshIdentity } from "../../../src/types/mesh_identity.type.ts"

const pki = new URL("../../../../tests/fixtures/pki/", import.meta.url)

function meshIdentityOf(name: string): MeshIdentity {
  return {
    certificate: readFileSync(new URL(`${name}/tls.crt`, pki)),
    privateKey: readFileSync(new URL(`${name}/tls.key`, pki)),
    authority: readFileSync(new URL(`${name}/ca.pem`, pki)),
    trustDomains: ["kinetix.local"]
  }
}

function unaryMethod<I extends DescMessage, O extends DescMessage>(
  path: string,
  input: I,
  output: O
): MethodDefinition<MessageShape<I>, MessageShape<O>> {
  return {
    path,
    requestStream: false,
    responseStream: false,
    requestSerialize(message: MessageShape<I>): Buffer {
      return Buffer.from(toBinary(input, message))
    },
    requestDeserialize(bytes: Buffer): MessageShape<I> {
      return fromBinary(input, bytes)
    },
    responseSerialize(message: MessageShape<O>): Buffer {
      return Buffer.from(toBinary(output, message))
    },
    responseDeserialize(bytes: Buffer): MessageShape<O> {
      return fromBinary(output, bytes)
    }
  }
}

async function startFeedServer<Request, Response>(
  name: string,
  method: MethodDefinition<Request, Response>,
  answer: (request: Request) => Response | ServiceError
): Promise<{ address: string; stop: () => void }> {
  const identity = meshIdentityOf(name)
  const server = new Server()

  server.addService(
    { call: method },
    {
      call(call: ServerUnaryCall<Request, Response>, respond: sendUnaryData<Response>): void {
        const outcome = answer(call.request)

        if (outcome instanceof Error) {
          respond(outcome)

          return
        }

        respond(null, outcome)
      }
    }
  )

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      "127.0.0.1:0",
      ServerCredentials.createSsl(
        identity.authority,
        [{ private_key: identity.privateKey, cert_chain: identity.certificate }],
        true
      ),
      (error, bound) => {
        if (error !== null) {
          reject(error)

          return
        }

        resolve(bound)
      }
    )
  })

  return {
    address: `localhost:${port}`,
    stop(): void {
      server.forceShutdown()
    }
  }
}

export { meshIdentityOf, startFeedServer, unaryMethod }
