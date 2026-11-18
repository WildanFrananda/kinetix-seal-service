import { Client } from "@grpc/grpc-js"

import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import { meshChannelCredentials } from "./mesh_channel_credentials.ts"

function meshGrpcClient(address: string, identity: MeshIdentity, peer: string): Client {
  return new Client(address, meshChannelCredentials(identity, peer))
}

export { meshGrpcClient }
