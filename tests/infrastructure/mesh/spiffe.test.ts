import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { serviceOfCertificate } from "../../../src/infrastructure/mesh/spiffe.ts"

const domains = ["kinetix.local"]

describe("a mesh certificate's service", () => {
  it("is read from its one SPIFFE ID in a trusted domain", () => {
    assert.equal(
      serviceOfCertificate(
        "DNS:kinetix-matching-service, DNS:kinetix-matching-grpc, URI:spiffe://kinetix.local/service/matching",
        domains
      ),
      "matching"
    )
  })

  it("is nobody for a domain that is not trusted, a deeper path, or no SPIFFE ID at all", () => {
    assert.equal(serviceOfCertificate("URI:spiffe://evil.example/service/matching", domains), undefined)
    assert.equal(serviceOfCertificate("URI:spiffe://kinetix.local/service/matching/extra", domains), undefined)
    assert.equal(serviceOfCertificate("DNS:kinetix-matching-service", domains), undefined)
    assert.equal(serviceOfCertificate(undefined, domains), undefined)
  })

  it("is nobody when a certificate names two services", () => {
    assert.equal(
      serviceOfCertificate(
        "URI:spiffe://kinetix.local/service/matching, URI:spiffe://kinetix.local/service/review",
        domains
      ),
      undefined
    )
  })
})
