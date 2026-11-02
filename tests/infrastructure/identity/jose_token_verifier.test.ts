import assert from "node:assert/strict"
import { generateKeyPairSync, type KeyObject } from "node:crypto"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import { exportJWK, type JWTPayload, SignJWT } from "jose"

import JoseTokenVerifier from "../../../src/infrastructure/identity/jose_token_verifier.adapter.ts"

const issuer = "https://identity.kinetix.local"
const audience = "kinetix"
const signing = generateKeyPairSync("rsa", { modulusLength: 2048 })
const stranger = generateKeyPairSync("rsa", { modulusLength: 2048 })

let server: Server
let jwksUrl: string
let keySetStatus = 200

async function publishedKeys(): Promise<string> {
  const jwk = await exportJWK(signing.publicKey)

  return JSON.stringify({ keys: [{ ...jwk, kid: "identity-1", alg: "RS256", use: "sig" }] })
}

async function token(
  claims: JWTPayload,
  options: { key?: KeyObject; kid?: string; expiresIn?: string; issuer?: string; audience?: string } = {}
): Promise<string> {
  return new SignJWT({ token_use: "access", role: "courier", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: options.kid ?? "identity-1" })
    .setSubject("drv_1")
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? audience)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "15m")
    .sign(options.key ?? signing.privateKey)
}

function verifierFor(url: string): JoseTokenVerifier {
  return new JoseTokenVerifier({ jwksUrl: url, issuer, audience, timeoutSeconds: 2 })
}

describe("verifying identity's access tokens", () => {
  before(async () => {
    const keys = await publishedKeys()

    server = createServer((_request, response) => {
      response.writeHead(keySetStatus, { "Content-Type": "application/json" })
      response.end(keySetStatus === 200 ? keys : "{}")
    })
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve)
    })
    jwksUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/.well-known/jwks.json`
  })

  after(() => {
    server.close()
  })

  it("names the principal and role of a valid access token", async () => {
    const verdict = await verifierFor(jwksUrl).verify(`Bearer ${await token({})}`)

    assert.deepEqual(verdict, { kind: "principal", principal: { principalId: "drv_1", role: "courier" } })
  })

  it("refuses a refresh, challenge or enrolment token", async () => {
    const verifier = verifierFor(jwksUrl)

    for (const use of ["refresh", "mfa_challenge", "mfa_enrolment"]) {
      const verdict = await verifier.verify(`Bearer ${await token({ token_use: use })}`)

      assert.deepEqual(verdict, { kind: "refused", reason: "the token is not an access token" }, use)
    }
  })

  it("refuses a token from another issuer, for another audience, expired, or signed by another key", async () => {
    const verifier = verifierFor(jwksUrl)
    const refused = [
      await token({}, { issuer: "https://elsewhere.example" }),
      await token({}, { audience: "other" }),
      await token({}, { expiresIn: "-5m" }),
      await token({}, { key: stranger.privateKey }),
      await token({}, { key: stranger.privateKey, kid: "unknown-kid" })
    ]

    for (const raw of refused) {
      assert.equal((await verifier.verify(`Bearer ${raw}`)).kind, "refused")
    }
  })

  it("refuses a token without a role", async () => {
    const verdict = await verifierFor(jwksUrl).verify(`Bearer ${await token({ role: "" })}`)

    assert.deepEqual(verdict, { kind: "refused", reason: "the token names no role" })
  })

  it("refuses a token signed with a symmetric key", async () => {
    const forged = await new SignJWT({ token_use: "access", role: "courier" })
      .setProtectedHeader({ alg: "HS256", kid: "identity-1" })
      .setSubject("drv_1")
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("a".repeat(64)))

    assert.equal((await verifierFor(jwksUrl).verify(`Bearer ${forged}`)).kind, "refused")
  })

  it("refuses a missing or malformed authorization header", async () => {
    const verifier = verifierFor(jwksUrl)

    for (const header of [undefined, "", "Bearer", "Basic dXNlcjpwYXNz", `Token ${await token({})}`]) {
      assert.equal((await verifier.verify(header)).kind, "refused", String(header))
    }
  })

  it("says identity is unavailable, not that the token is bad, when its keys cannot be read", async () => {
    keySetStatus = 503

    try {
      const verdict = await verifierFor(`${jwksUrl}?fresh=1`).verify(`Bearer ${await token({})}`)

      assert.equal(verdict.kind, "unavailable")
    } finally {
      keySetStatus = 200
    }

    const unreachable = await verifierFor("http://127.0.0.1:1/.well-known/jwks.json").verify(
      `Bearer ${await token({})}`
    )

    assert.equal(unreachable.kind, "unavailable")
  })
})
