import { Counter, type Registry } from "prom-client"

import type { FeedMetricsPort } from "../../application/ports/feed_metrics.port.ts"
import type { FeedFailureKind } from "../../types/feed_failure_kind.type.ts"
import type { FeedStream } from "../../types/feed_stream.type.ts"

const streams: readonly FeedStream[] = ["deliveries", "reviews"]
const kinds: readonly FeedFailureKind[] = ["refused", "unavailable", "invalid_page", "store"]

class PrometheusFeedMetrics implements FeedMetricsPort {
  readonly #records: Counter<"stream">
  readonly #failures: Counter<"stream" | "kind">

  constructor(registry: Registry) {
    this.#records = new Counter({
      name: "kinetix_seal_feed_records_total",
      help: "Records seal kept from the fact feeds, by stream",
      labelNames: ["stream"],
      registers: [registry]
    })
    this.#failures = new Counter({
      name: "kinetix_seal_feed_failures_total",
      help: "Fact feed reads that stopped short, by stream and kind",
      labelNames: ["stream", "kind"],
      registers: [registry]
    })

    for (const stream of streams) {
      this.#records.inc({ stream }, 0)

      for (const kind of kinds) {
        this.#failures.inc({ stream, kind }, 0)
      }
    }
  }

  recorded(stream: FeedStream, count: number): void {
    this.#records.inc({ stream }, count)
  }

  failed(stream: FeedStream, kind: FeedFailureKind): void {
    this.#failures.inc({ stream, kind })
  }
}

export default PrometheusFeedMetrics
