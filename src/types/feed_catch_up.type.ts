import type { FeedStream } from "./feed_stream.type.ts"

type FeedCatchUp = Record<FeedStream, Date | undefined>

export type { FeedCatchUp }
