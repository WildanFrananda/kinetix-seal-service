type LayoutProblem = {
  line: number
  rule: "after-block" | "cuddled-check" | "cuddled-return" | "blank-after-open" | "blank-before-close"
  fix: { insertBlankBefore: number } | { removeBlankLine: number }
}

export type { LayoutProblem }
