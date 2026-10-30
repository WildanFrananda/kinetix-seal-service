import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"

import IndexerBlocks from "../../../src/infrastructure/midnight/indexer_blocks.ts"

const fixtures = new URL("../../../../tests/fixtures/indexer/", import.meta.url)
const answers = new Map<string, { status: number; body: string }>()
const asked: Array<{ projectId: string | null; query: string }> = []
let server: Server
let base = ""

async function fixture(name: string): Promise<string> {
  return readFile(new URL(name, fixtures), "utf8")
}

before(async () => {
  answers.set("{ block(offset: { height: 0 }) { hash height } }", {
    status: 200,
    body: await fixture("block_at_height_0.json")
  })
  answers.set("{ block { hash height } }", { status: 200, body: await fixture("tip.json") })
  answers.set("{ block(offset: { height: 999999999 }) { hash height } }", {
    status: 200,
    body: await fixture("block_beyond_tip.json")
  })
  answers.set("{ block(offset: { height: 7 }) { hash height } }", {
    status: 200,
    body: await fixture("refused_query.json")
  })
  answers.set("{ block(offset: { height: 8 }) { hash height } }", { status: 503, body: "" })

  server = createServer((request, response) => {
    let body = ""

    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => {
      const query = (JSON.parse(body) as { query: string }).query
      const answer = answers.get(query) ?? { status: 400, body: "" }

      asked.push({ projectId: new URL(request.url ?? "", "http://indexer").searchParams.get("project_id"), query })
      response.writeHead(answer.status, { "content-type": "application/json" }).end(answer.body)
    })
  })

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v0`
})

after(() => {
  server.close()
})

describe("blocks from the indexer", () => {
  it("reads a block's hash at a height, with the project key in the query string", async () => {
    const blocks = new IndexerBlocks(base, "nightpreprodTEST", 5)

    assert.equal(await blocks.hashAt(0), "df831b09a8baa92badf47762ce5ac439b7e47e3ed3d39600cfdd44fad552361b")
    assert.equal(asked.at(-1)?.projectId, "nightpreprodTEST")
  })

  it("reads the tip's height", async () => {
    assert.equal(await new IndexerBlocks(base, "k", 5).tipHeight(), 3_201_705)
  })

  it("answers no hash for a height the chain has not reached", async () => {
    assert.equal(await new IndexerBlocks(base, "k", 5).hashAt(999_999_999), undefined)
  })

  it("fails on a refused query or an error status, rather than answering", async () => {
    const blocks = new IndexerBlocks(base, "k", 5)

    await assert.rejects(blocks.hashAt(7), /the indexer refused the query/)
    await assert.rejects(blocks.hashAt(8), /the indexer answered 503/)
  })
})
