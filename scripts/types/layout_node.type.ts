import type { LayoutPosition } from "./layout_position.type.ts"

type LayoutNode = {
  type: string
  loc?: { start: LayoutPosition; end: LayoutPosition } | null
  leadingComments?: ReadonlyArray<{ loc?: { start: LayoutPosition } | null }> | null
  [key: string]: unknown
}

export type { LayoutNode }
