import { parse } from "@babel/parser"
import type { LayoutNode } from "./types/layout_node.type.ts"
import type { LayoutProblem } from "./types/layout_problem.type.ts"

const checkTypes = new Set([
  "IfStatement",
  "ForStatement",
  "ForOfStatement",
  "ForInStatement",
  "WhileStatement",
  "DoWhileStatement",
  "SwitchStatement"
])

const blockTypes = new Set(["BlockStatement", "StaticBlock", "TSModuleBlock"])

function isNode(value: unknown): value is LayoutNode {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "type") === "string"
}

function children(node: LayoutNode): LayoutNode[] {
  const found: LayoutNode[] = []

  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") {
      continue
    }

    if (Array.isArray(value)) {
      found.push(...value.filter(isNode))
    } else if (isNode(value)) {
      found.push(value)
    }
  }

  return found
}

function startLine(node: LayoutNode): number {
  const own = node.loc?.start.line ?? 0
  const comments = (node.leadingComments ?? []).map((comment) => comment.loc?.start.line ?? own)

  return Math.min(own, ...comments)
}

function endLine(node: LayoutNode): number {
  return node.loc?.end.line ?? 0
}

function identifiersIn(node: unknown, names: Set<string>): Set<string> {
  if (!isNode(node)) {
    return names
  }

  if (node.type === "Identifier" && typeof node.name === "string") {
    names.add(node.name)
  }

  for (const child of children(node)) {
    identifiersIn(child, names)
  }

  return names
}

function boundBy(statement: LayoutNode): Set<string> {
  if (statement.type === "VariableDeclaration" && Array.isArray(statement.declarations)) {
    const names = new Set<string>()

    for (const declaration of statement.declarations) {
      if (isNode(declaration)) {
        identifiersIn(declaration.id, names)
      }
    }

    return names
  }

  const expression = statement.type === "ExpressionStatement" ? statement.expression : null
  if (isNode(expression) && expression.type === "AssignmentExpression") {
    return identifiersIn(expression.left, new Set())
  }

  if (isNode(expression) && expression.type === "UpdateExpression") {
    return identifiersIn(expression.argument, new Set())
  }

  return new Set()
}

function readBy(check: LayoutNode): Set<string> {
  const names = new Set<string>()

  for (const key of ["test", "init", "update", "right", "discriminant"]) {
    identifiersIn(check[key], names)
  }

  return names
}

function readsWhatItFollows(previous: LayoutNode, next: LayoutNode): boolean {
  if (!checkTypes.has(next.type)) {
    return false
  }

  const read = readBy(next)

  return [...boundBy(previous)].some((name) => read.has(name))
}

function statementLists(node: LayoutNode): LayoutNode[][] {
  if (node.type === "Program" || blockTypes.has(node.type)) {
    return Array.isArray(node.body) ? [node.body.filter(isNode)] : []
  }

  if (node.type === "SwitchCase" && Array.isArray(node.consequent)) {
    return [node.consequent.filter(isNode)]
  }

  return []
}

function blankLinesBetween(lines: readonly string[], after: number, before: number): number[] {
  const blanks: number[] = []

  for (let line = after + 1; line < before; line += 1) {
    if ((lines[line - 1] ?? "").trim() === "") {
      blanks.push(line)
    }
  }

  return blanks
}

function listProblems(list: readonly LayoutNode[], lines: readonly string[]): LayoutProblem[] {
  const problems: LayoutProblem[] = []
  const first = list[0]

  for (let index = 1; index < list.length; index += 1) {
    const previous = list[index - 1]
    const next = list[index]
    if (previous === undefined || next === undefined || first === undefined) {
      continue
    }

    const nextStart = startLine(next)
    const previousEnd = endLine(previous)
    if (nextStart <= previousEnd || blankLinesBetween(lines, previousEnd, nextStart).length > 0) {
      continue
    }

    const fix = { insertBlankBefore: nextStart }
    const bothImports = previous.type === "ImportDeclaration" && next.type === "ImportDeclaration"
    const multiLine = previousEnd > (previous.loc?.start.line ?? previousEnd)
    if (multiLine && !bothImports && !readsWhatItFollows(previous, next)) {
      problems.push({ line: nextStart, rule: "after-block", fix })
      continue
    }

    if (checkTypes.has(next.type) && !readsWhatItFollows(previous, next)) {
      problems.push({ line: nextStart, rule: "cuddled-check", fix })
      continue
    }

    if (next.type === "ReturnStatement" && nextStart - startLine(first) >= 2) {
      problems.push({ line: nextStart, rule: "cuddled-return", fix })
    }
  }

  return problems
}

function edgeProblems(block: LayoutNode, lines: readonly string[]): LayoutProblem[] {
  const body = Array.isArray(block.body) ? block.body.filter(isNode) : []
  const first = body[0]
  const last = body[body.length - 1]
  if (!blockTypes.has(block.type) || first === undefined || last === undefined) {
    return []
  }

  const opening = blankLinesBetween(lines, block.loc?.start.line ?? 0, startLine(first)).map(
    (line): LayoutProblem => ({ line, rule: "blank-after-open", fix: { removeBlankLine: line } })
  )

  const closing = blankLinesBetween(lines, endLine(last), endLine(block)).map(
    (line): LayoutProblem => ({ line, rule: "blank-before-close", fix: { removeBlankLine: line } })
  )

  return [...opening, ...closing]
}

function layoutProblems(source: string, path: string): LayoutProblem[] {
  const plugins: Array<"typescript" | "jsx"> = path.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"]
  const program: unknown = parse(source, { sourceType: "module", plugins }).program
  const lines = source.split("\n")
  const problems: LayoutProblem[] = []
  const pending: unknown[] = [program]
  while (pending.length > 0) {
    const node = pending.pop()
    if (!isNode(node)) {
      continue
    }

    for (const list of statementLists(node)) {
      problems.push(...listProblems(list, lines))
    }

    problems.push(...edgeProblems(node, lines))
    pending.push(...children(node))
  }

  return problems.sort((a, b) => a.line - b.line)
}

function fixLayout(source: string, problems: readonly LayoutProblem[]): string {
  const lines = source.split("\n")
  const inserts = new Set<number>()
  const removals = new Set<number>()

  for (const problem of problems) {
    if ("insertBlankBefore" in problem.fix) {
      inserts.add(problem.fix.insertBlankBefore)
    } else {
      removals.add(problem.fix.removeBlankLine)
    }
  }

  const touched = [...new Set([...inserts, ...removals])].sort((a, b) => b - a)
  for (const line of touched) {
    if (removals.has(line)) {
      lines.splice(line - 1, 1)
    } else {
      lines.splice(line - 1, 0, "")
    }
  }

  return lines.join("\n")
}

export { fixLayout, layoutProblems }
