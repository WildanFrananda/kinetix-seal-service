import { hexOf } from "../../holder/src/hex.ts"
import type { PredicateChoice } from "../types/predicate_choice.type.ts"
import type { PredicateMenu } from "../types/predicate_menu.type.ts"
import AnswerFrames from "./answer_frames.ts"
import CameraScanner from "./camera_scanner.ts"
import IssuedRequests from "./issued_requests.ts"
import { linkAnswerOf } from "./link_answer.ts"
import { minimumLinesOf } from "./minimum_lines.ts"
import { choiceWithRow, predicateMenuOf } from "./predicate_menu.ts"
import { requestCode } from "./presentation_request.ts"
import { qrMatrix } from "./qr_matrix.ts"
import { answerStatus, readPredicates, relayAnswer } from "./seal_client.ts"
import { button, element, qrSvg } from "./view.ts"

const pollMilliseconds = 5_000
const polls = 36
const answerUrl = `${location.origin}/api/v1/seal/verify`
const requests = new IssuedRequests(window.localStorage)
const scanner = new CameraScanner()

function root(): HTMLElement {
  const found = document.getElementById("verifier")

  if (found === null) {
    throw new Error("the page has no verifier element")
  }

  return found
}

function show(...children: Array<Node | string>): void {
  root().replaceChildren(element("h1", "Check a courier's credential"), ...children)
}

function describe(choice: PredicateChoice): HTMLElement {
  const list = element("ul", undefined, "minimums")

  list.append(...minimumLinesOf(choice).map((line) => element("li", line)))

  return list
}

async function menu(): Promise<PredicateMenu | undefined> {
  try {
    return predicateMenuOf(await readPredicates())
  } catch {
    return undefined
  }
}

async function choose(): Promise<void> {
  show(element("p", "Loading what can be checked…"))

  const offered = await menu()

  if (offered === undefined) {
    show(element("p", "The checks cannot be loaded right now. Try again in a minute."), button("Try again", start))

    return
  }

  if (offered.choices.length === 0) {
    show(element("p", "No checks are offered yet."))

    return
  }

  const list = element("div", undefined, "choices")

  for (const choice of offered.choices) {
    const card = element("section", undefined, "choice")

    card.append(
      element("h2", choice.label),
      describe(choice),
      button("Ask for this", () => request(offered, choice))
    )

    list.append(card)
  }

  show(element("p", "Choose what you want to know about the courier. You learn only whether it is true."), list)
}

function request(offered: PredicateMenu, choice: PredicateChoice): void {
  const challenge = hexOf(crypto.getRandomValues(new Uint8Array(32)))
  const code = requestCode({
    contractAddress: offered.contractAddress,
    predicateId: choice.rowId,
    challenge,
    answerUrl
  })

  requests.remember({ challenge, predicateId: choice.rowId, label: choice.label, issuedAt: Date.now() }, Date.now())
  show(
    element("h2", choice.label),
    describe(choice),
    qrSvg(qrMatrix(code)),
    element(
      "p",
      "Ask the courier to scan this code with the Kinetix courier app. Their phone takes about a minute to answer."
    ),
    button("Scan the courier's answer", () => {
      void scan(challenge)
    }),
    element("p", "If the courier sends a link instead, open it in this browser.", "hint"),
    button("Start over", start, "secondary")
  )
}

async function scan(challenge: string): Promise<void> {
  const frames = new AnswerFrames()
  const video = document.createElement("video")
  const progress = element("p", "Point the camera at the code on the courier's phone.")

  video.className = "camera"
  video.muted = true
  show(
    video,
    progress,
    button(
      "Cancel",
      () => {
        scanner.stop()
        start()
      },
      "secondary"
    )
  )

  try {
    await scanner.start(video, (text) => {
      if (!frames.accept(text)) {
        return
      }

      progress.textContent = `Reading the answer: ${frames.received()} of ${frames.expected()} parts`
      void frames.transaction().then((transaction) => {
        if (transaction !== undefined) {
          scanner.stop()
          void settle(challenge, transaction)
        }
      })
    })
  } catch {
    show(
      element("p", "The camera could not be opened. Allow it for this page, or ask the courier to send a link."),
      button("Back", start, "secondary")
    )
  }
}

async function settle(challenge: string, transaction: string): Promise<void> {
  show(element("p", "Confirming the answer…"))

  const before = await answerStatus(challenge)

  if (before.kind === "answered") {
    await verdict(challenge, before.predicateId)

    return
  }

  const relayed = await relayAnswer(transaction)

  if (relayed.kind === "refused") {
    show(element("p", `The answer could not be used: ${relayed.message}.`), button("Start over", start, "secondary"))

    return
  }

  if (relayed.kind === "unavailable") {
    show(
      element("p", "The answer cannot be confirmed right now. Keep this page open and try again."),
      button("Try again", () => {
        void settle(challenge, transaction)
      })
    )

    return
  }

  for (let poll = 0; poll < polls; poll += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, pollMilliseconds)
    })

    const status = await answerStatus(challenge)

    if (status.kind === "answered") {
      await verdict(challenge, status.predicateId)

      return
    }
  }

  show(
    element("p", "The answer is not confirmed yet. It may still arrive; check again in a few minutes."),
    button("Check again", () => {
      void settle(challenge, transaction)
    })
  )
}

async function verdict(challenge: string, predicateId: string): Promise<void> {
  const issued = requests.find(challenge, Date.now())
  const offered = await menu()
  const choice = offered === undefined ? undefined : choiceWithRow(offered, predicateId)
  const described = choice === undefined ? element("p", "The check it answered is no longer listed.") : describe(choice)

  if (issued !== undefined && issued.predicateId !== predicateId) {
    show(element("p", "This answer is for a different check than the one you asked for.", "refused"), described)

    return
  }

  const heading = element("p", `Verified: ${choice?.label ?? issued?.label ?? "the courier's credential"}`, "verified")
  const binding =
    issued === undefined
      ? element(
          "p",
          "This browser did not make this request, so it cannot tell whether the answer was meant for you.",
          "hint"
        )
      : element("p", `This answers the request you made at ${new Date(issued.issuedAt).toLocaleTimeString()}.`)

  show(
    heading,
    element("p", "The courier's credential meets all of this:"),
    described,
    binding,
    button("Check another", start)
  )
}

function start(): void {
  const answer = linkAnswerOf(location.hash)

  if (answer !== undefined) {
    history.replaceState(null, "", location.pathname)
    void settle(answer.challenge, answer.transactionHex)

    return
  }

  void choose()
}

start()
