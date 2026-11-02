import { globSync, readFileSync, writeFileSync } from "node:fs"

import { fixLayout, layoutProblems } from "./layout_rules.ts"

const patterns = ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts", "prisma.config.ts"]

const skipped = [/^src\/infrastructure\/postgres\/generated\//]

const fixing = process.argv.includes("--fix")

function sources(): string[] {
  const found = new Set<string>()

  for (const pattern of patterns) {
    for (const path of globSync(pattern, { cwd: process.cwd() })) {
      if (!skipped.some((rule) => rule.test(path))) {
        found.add(path)
      }
    }
  }

  return [...found].sort()
}

function settled(source: string, path: string): string {
  let current = source

  for (let pass = 0; pass < 5; pass += 1) {
    const problems = layoutProblems(current, path)

    if (problems.length === 0) {
      return current
    }

    current = fixLayout(current, problems)
  }

  return current
}

let reported = 0

for (const path of sources()) {
  const source = readFileSync(path, "utf8")
  const problems = layoutProblems(source, path)

  if (problems.length === 0) {
    continue
  }

  reported += problems.length

  if (fixing) {
    writeFileSync(path, settled(source, path))
    continue
  }

  for (const problem of problems) {
    process.stderr.write(`${path}:${problem.line} ${problem.rule}\n`)
  }
}

if (reported > 0 && !fixing) {
  process.stderr.write(
    `layout: ${reported} place(s) are too compact or padded; run node scripts/check_layout.ts --fix\n`
  )

  process.exit(1)
}

process.stdout.write(
  fixing ? `layout: fixed ${reported} place(s)\n` : "layout: every block is spaced as the house style asks\n"
)
