import { checkServerIdentity, type PeerCertificate } from "node:tls"
import { type ChannelCredentials, credentials } from "@grpc/grpc-js"

import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import { serviceOfCertificate } from "./spiffe.ts"

function meshChannelCredentials(identity: MeshIdentity, server: string): ChannelCredentials {
  return credentials.createSsl(identity.authority, identity.privateKey, identity.certificate, {
    checkServerIdentity(hostname: string, certificate: PeerCertificate): Error | undefined {
      const hostnameError = checkServerIdentity(hostname, certificate)

      if (hostnameError !== undefined) {
        return hostnameError
      }

      const service = serviceOfCertificate(certificate.subjectaltname, identity.trustDomains)

      if (service !== server) {
        return new Error(`dialled ${server} but the server is ${service ?? "no mesh service"}`)
      }

      return undefined
    }
  })
}

export { meshChannelCredentials }
