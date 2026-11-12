import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"

import AnswerFrames from "../../verifier/src/answer_frames.ts"
import IssuedRequests from "../../verifier/src/issued_requests.ts"
import { linkAnswerOf } from "../../verifier/src/link_answer.ts"
import { minimumLinesOf } from "../../verifier/src/minimum_lines.ts"
import { choiceWithRow, predicateMenuOf } from "../../verifier/src/predicate_menu.ts"
import { requestCode } from "../../verifier/src/presentation_request.ts"
import { decodeQr } from "../../verifier/src/qr_decoder.ts"
import { qrMatrix } from "../../verifier/src/qr_matrix.ts"
import FakeRequestStorage from "../fakes/fake_request_storage.ts"

const challenge = "c0".repeat(32)
const transaction = Buffer.from(Array.from({ length: 3604 }, (_, index) => index % 256))

function appFrames(bytes: Buffer): string[] {
  const encoded = bytes.toString("base64url")
  const tag = createHash("sha256").update(bytes).digest("hex").slice(0, 8)
  const total = Math.ceil(encoded.length / 600)

  return Array.from(
    { length: total },
    (_, index) => `KSP1:${tag}:${index + 1}/${total}:${encoded.slice(index * 600, (index + 1) * 600)}`
  )
}

describe("the verifier's request code", () => {
  it("is the URI the courier app reads", () => {
    const code = new URL(
      requestCode({
        contractAddress: "5d95",
        predicateId: "aa".repeat(32),
        challenge,
        answerUrl: "https://api.example/api/v1/seal/verify"
      })
    )

    assert.equal(code.protocol, "kinetix-seal:")
    assert.equal(code.pathname, "present")
    assert.deepEqual(Object.fromEntries(code.searchParams), {
      v: "1",
      r: "5d95",
      p: "aa".repeat(32),
      c: challenge,
      a: "https://api.example/api/v1/seal/verify"
    })
  })

  it("fits one QR code", () => {
    const matrix = qrMatrix(
      requestCode({
        contractAddress: "5d".repeat(32),
        predicateId: "aa".repeat(32),
        challenge,
        answerUrl: "https://api.wildanfrananda.my.id/api/v1/seal/verify"
      })
    )

    assert.ok(matrix.length >= 21)
    assert.ok(matrix.every((row) => row.length === matrix.length))
  })

  it("is read back by the page's own decoder", () => {
    const code = requestCode({
      contractAddress: "5d".repeat(32),
      predicateId: "aa".repeat(32),
      challenge,
      answerUrl: "https://api.wildanfrananda.my.id/api/v1/seal/verify"
    })

    const matrix = qrMatrix(code)
    const scale = 4
    const size = (matrix.length + 8) * scale
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255)

    for (const [row, cells] of matrix.entries()) {
      for (const [column, dark] of cells.entries()) {
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const offset = (((row + 4) * scale + dy) * size + (column + 4) * scale + dx) * 4

            if (dark) {
              pixels.fill(0, offset, offset + 3)
            }
          }
        }
      }
    }

    assert.equal(decodeQr(pixels, size, size)?.data, code)
  })
})

describe("the courier's answer, in person", () => {
  it("is rebuilt from the app's cycling frames in any order, repeats included", async () => {
    const frames = new AnswerFrames()
    const shown = appFrames(transaction)

    for (const frame of [...shown].reverse().concat(shown)) {
      assert.equal(frames.accept(frame), true)
    }

    assert.equal(frames.received(), shown.length)
    assert.equal(await frames.transaction(), transaction.toString("hex"))
  })

  it("waits for every part, and starts over for another answer", async () => {
    const frames = new AnswerFrames()
    const shown = appFrames(transaction)
    const other = appFrames(Buffer.from("another answer"))

    for (const frame of shown.slice(1)) {
      frames.accept(frame)
    }

    assert.equal(await frames.transaction(), undefined)

    frames.accept(other[0] ?? "")

    assert.equal(frames.received(), 1)
    assert.equal(await frames.transaction(), Buffer.from("another answer").toString("hex"))
  })

  it("refuses frames that are not the app's, or whose parts do not hash to their tag", async () => {
    const frames = new AnswerFrames()
    const [only] = appFrames(Buffer.from("short"))

    assert.equal(frames.accept("https://example.com"), false)
    assert.equal(frames.accept("KSP1:zzzzzzzz:1/1:abc"), false)
    assert.equal(frames.accept("KSP1:00000000:2/1:abc"), false)
    frames.accept((only ?? "").replace(/:[^:]+$/, ":AAAA"))

    assert.equal(await frames.transaction(), undefined)
  })
})

describe("the courier's answer, by link", () => {
  it("carries the challenge and the transaction in the fragment", () => {
    assert.deepEqual(linkAnswerOf(`#${challenge}.${Buffer.from([10, 11, 12]).toString("base64url")}`), {
      challenge,
      transactionHex: "0a0b0c"
    })

    assert.equal(linkAnswerOf("#nothing"), undefined)
    assert.equal(linkAnswerOf(`#${challenge}.a`), undefined)
  })
})

describe("the requests this browser made", () => {
  it("are kept for two hours, twenty at most", () => {
    const storage = new FakeRequestStorage()
    const requests = new IssuedRequests(storage)
    const at = 1_800_000_000_000

    for (let index = 0; index < 25; index += 1) {
      requests.remember({ challenge: String(index).padStart(64, "0"), predicateId: "aa", label: "l", issuedAt: at }, at)
    }

    assert.equal(requests.find("4".padStart(64, "0"), at), undefined)
    assert.equal(requests.find("5".padStart(64, "0"), at)?.label, "l")
    assert.equal(requests.find("24".padStart(64, "0"), at)?.predicateId, "aa")
    assert.equal(requests.find("24".padStart(64, "0"), at + 2 * 60 * 60 * 1000), undefined)
  })

  it("survive a storage this page did not write", () => {
    const storage = new FakeRequestStorage()

    storage.setItem("kinetix.seal.verifier.requests", "not json")

    assert.equal(new IssuedRequests(storage).find(challenge, 0), undefined)
  })
})

describe("the checks offered", () => {
  const listing = {
    registry: { generation: 1, contractAddress: "5d95" },
    predicates: [
      {
        label: "Experienced courier",
        minimums: { deliveries: 100, ratingHundredths: 450, daysActive: 90 },
        rows: [
          { id: "aa", minimumIssueDate: "2026-10-06", current: true, placed: true },
          { id: "bb", minimumIssueDate: "2026-09-29", current: false, placed: true }
        ]
      },
      {
        label: "Not placed yet",
        minimums: { deliveries: 1, ratingHundredths: 0, daysActive: 0 },
        rows: [{ id: "cc", minimumIssueDate: "2026-10-06", current: true, placed: false }]
      }
    ]
  }

  it("are the current rows the registry holds, and every row can still be described", () => {
    const menu = predicateMenuOf(listing)

    assert.equal(menu?.contractAddress, "5d95")
    assert.deepEqual(
      menu?.choices.map((choice) => choice.rowId),
      ["aa"]
    )

    assert.equal(menu === undefined ? undefined : choiceWithRow(menu, "bb")?.issuedSince, "2026-09-29")
    assert.equal(predicateMenuOf({ predicates: [] }), undefined)
  })
})

describe("the minimums the verdict lists", () => {
  it("name one delivery and one day in the singular, and every other count in the plural", () => {
    const choice = {
      label: "Test credentials",
      rowId: "aa",
      deliveries: 1,
      ratingHundredths: 400,
      daysActive: 1,
      issuedSince: "2026-10-06"
    }

    assert.deepEqual(minimumLinesOf(choice), [
      "At least 1 delivery",
      "A rating of at least 4.00",
      "Active for at least 1 day",
      "Numbers as of 2026-10-06 or later"
    ])

    const none = minimumLinesOf({ ...choice, deliveries: 0, daysActive: 0 })

    assert.equal(none[0], "At least 0 deliveries")
    assert.equal(none[2], "Active for at least 0 days")
    assert.equal(minimumLinesOf({ ...choice, deliveries: 25 })[0], "At least 25 deliveries")
  })
})
