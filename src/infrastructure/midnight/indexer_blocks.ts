import { withProjectId } from "./blockfrost_url.ts"

type BlockAnswer = {
  data?: { block: { hash: string; height: number } | null }
  errors?: Array<{ message: string }>
}

class IndexerBlocks {
  private readonly url: string
  private readonly timeoutSeconds: number

  constructor(indexerHttpUrl: string, projectId: string, timeoutSeconds: number) {
    this.url = withProjectId(indexerHttpUrl, projectId)
    this.timeoutSeconds = timeoutSeconds
  }

  async hashAt(height: number): Promise<string | undefined> {
    const block = await this.block(`{ block(offset: { height: ${Math.trunc(height)} }) { hash height } }`)

    return block?.hash
  }

  async tipHeight(): Promise<number> {
    const block = await this.block("{ block { hash height } }")

    if (block === undefined) {
      throw new Error("the indexer answered without a block")
    }

    return block.height
  }

  private async block(query: string): Promise<{ hash: string; height: number } | undefined> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(this.timeoutSeconds * 1000)
    })

    if (!response.ok) {
      throw new Error(`the indexer answered ${response.status}`)
    }

    const answer = (await response.json()) as BlockAnswer

    if (answer.errors !== undefined && answer.errors.length > 0) {
      throw new Error(`the indexer refused the query: ${answer.errors.map((error) => error.message).join("; ")}`)
    }

    return answer.data?.block ?? undefined
  }
}

export default IndexerBlocks
