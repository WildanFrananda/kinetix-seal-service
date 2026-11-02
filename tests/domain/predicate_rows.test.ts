import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { predicateRowsOf } from "../../src/domain/predicate_rows.ts"
import { predicateTemplate } from "../fakes/predicate_template.ts"

describe("the registry rows of a predicate", () => {
  it("adds a minimum issue day to the template's minimums, for this period and the one before", () => {
    const rows = predicateRowsOf(predicateTemplate({ freshnessDays: 30 }), 20_759, 7)

    assert.deepEqual(
      rows.map((row) => [row.period, row.minimumIssueDay, row.current, row.predicate.minimums]),
      [
        [2965, 20_725, true, [100n, 450n, 90n, 20_725n]],
        [2964, 20_718, false, [100n, 450n, 90n, 20_718n]]
      ]
    )
  })

  it("keeps the same rows through a period and moves on at its end", () => {
    const template = predicateTemplate({})

    function minimumsOn(day: number): number[] {
      return predicateRowsOf(template, day, 7).map((row) => row.minimumIssueDay)
    }

    assert.deepEqual(minimumsOn(20_755), minimumsOn(20_761))
    assert.deepEqual(minimumsOn(20_762), [20_732, 20_725])
  })

  it("never asks for an issue day before the first", () => {
    assert.deepEqual(
      predicateRowsOf(predicateTemplate({ freshnessDays: 30 }), 3, 7).map((row) => row.minimumIssueDay),
      [0]
    )
  })
})
