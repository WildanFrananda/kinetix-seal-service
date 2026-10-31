import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { after, describe, it } from "node:test"
import type { FastifyInstance } from "fastify"

import SponsorUnavailable from "../../../src/domain/sponsor_unavailable.ts"
import HttpsSponsorClient from "../../../src/infrastructure/sponsor/https_sponsor_client.ts"
import { buildSponsorApi } from "../../../src/infrastructure/sponsor/sponsor_api.ts"
import type { MeshIdentity } from "../../../src/types/mesh_identity.type.ts"
import FakeSponsorStateSource from "../../fakes/fake_sponsor_state_source.ts"
import RecordingLogger from "../../fakes/recording_logger.ts"
import RecordingTransactionPayer from "../../fakes/recording_transaction_payer.ts"
import { snapshot } from "../../fakes/snapshot.ts"

const pki = new URL("../../../../tests/fixtures/pki/", import.meta.url)
const closers: Array<() => Promise<void> | void> = []

function identityOf(name: string): MeshIdentity {
  return {
    certificate: readFileSync(new URL(`${name}/tls.crt`, pki)),
    privateKey: readFileSync(new URL(`${name}/tls.key`, pki)),
    authority: readFileSync(new URL(`${name}/ca.pem`, pki)),
    trustDomains: ["kinetix.local"]
  }
}

async function sponsorAs(name: string) {
  const state = new FakeSponsorStateSource()
  const payer = new RecordingTransactionPayer()
  const api: FastifyInstance = buildSponsorApi({
    identity: identityOf(name),
    state,
    payer,
    logger: new RecordingLogger()
  })

  await api.listen({ host: "127.0.0.1", port: 0 })
  closers.push(async () => {
    await api.close()
  })

  const port = (api.server.address() as AddressInfo).port

  return { state, payer, url: `https://localhost:${port}` }
}

function clientAs(name: string, url: string): HttpsSponsorClient {
  const client = new HttpsSponsorClient(url, identityOf(name), 5, 5)

  closers.push(() => {
    client.close()
  })

  return client
}

after(async () => {
  for (const close of closers) {
    await close()
  }
})

describe("the link between seal and its sponsor", () => {
  it("reads the sponsor's state, DUST balance and all", async () => {
    const sponsor = await sponsorAs("seal")

    sponsor.state.next = {
      condition: "low_dust",
      snapshot: snapshot({ dustBalance: 1_378_852_929_999_996_996n, dustCoins: 2 })
    }

    const state = await clientAs("seal", sponsor.url).state()

    assert.equal(state.condition, "low_dust")
    assert.equal(state.snapshot.dustBalance, 1_378_852_929_999_996_996n)
    assert.equal(state.snapshot.dustCoins, 2)
  })

  it("hands a transaction to the sponsor byte for byte, and answers its id", async () => {
    const sponsor = await sponsorAs("seal")
    const transaction = Uint8Array.from([0, 1, 2, 250, 251, 252])

    const txId = await clientAs("seal", sponsor.url).pay(transaction)

    assert.equal(txId, "00tx1")
    assert.deepEqual([...(sponsor.payer.paid[0] ?? [])], [...transaction])
  })

  it("refuses to pay while the sponsor's wallet syncs", async () => {
    const sponsor = await sponsorAs("seal")

    sponsor.state.next = { condition: "syncing", snapshot: snapshot({ synced: false }) }

    await assert.rejects(
      clientAs("seal", sponsor.url).pay(Uint8Array.from([1])),
      /503: the sponsor wallet is still syncing/
    )
    assert.equal(sponsor.payer.paid.length, 0)
  })

  it("answers 503 when the wallet has not started", async () => {
    const sponsor = await sponsorAs("seal")

    sponsor.payer.failure = new SponsorUnavailable("the sponsor wallet has not started")

    await assert.rejects(
      clientAs("seal", sponsor.url).pay(Uint8Array.from([1])),
      /503: the sponsor wallet has not started/
    )
  })

  it("admits no caller but seal", async () => {
    const sponsor = await sponsorAs("seal")

    await assert.rejects(
      clientAs("review", sponsor.url).state(),
      /403: only seal may use the sponsor; this caller is review/
    )
  })

  it("refuses a sponsor that is not seal", async () => {
    const impostor = await sponsorAs("review")

    await assert.rejects(clientAs("seal", impostor.url).state(), /the sponsor answered as review/)
  })

  it("refuses a sponsor whose certificate another authority signed", async () => {
    const foreign = await sponsorAs("foreign-matching")

    await assert.rejects(clientAs("seal", foreign.url).state())
  })
})
