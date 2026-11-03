import { randomBytes } from "node:crypto"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import { predicateRowsOf } from "../../src/domain/predicate_rows.ts"
import { credentialLeafOf } from "../../src/infrastructure/midnight/credential_leaf.ts"
import type { IssuerPrivateState } from "../../src/types/issuer_private_state.type.ts"
import { credentialRecord } from "../fakes/credential_record.ts"
import { predicateTemplate } from "../fakes/predicate_template.ts"
import InMemoryCredentialRegistry from "../infrastructure/midnight/in_memory_credential_registry.ts"

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

async function presentationRequest(issueDay: number) {
  const issuer: IssuerPrivateState = { role: "issuer", issuerSecret: randomBytes(32) }
  const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)
  const [row] = predicateRowsOf(predicateTemplate({ minimums: [10n, 400n, 7n], freshnessDays: 30 }), 20_759, 7)

  if (row === undefined) {
    throw new Error("a template has a current row")
  }

  const holderSecret = randomBytes(32)
  const record = credentialRecord({
    attributes: [12n, 450n, 30n, BigInt(issueDay)],
    issueDay,
    holderPublicKey: pureCircuits.holderPublicKey(holderSecret),
    salt: randomBytes(32)
  })

  await registry.approvePredicate(row.predicate, issuer)
  await registry.issue(credentialLeafOf(record), issuer)

  return {
    registry,
    holderSecret,
    request: {
      snapshot: registry.snapshotWire(1),
      holderSecret: hex(holderSecret),
      credential: {
        classId: hex(record.classId),
        attributes: record.attributes.map((attribute) => attribute.toString()),
        salt: hex(record.salt)
      },
      leafIndex: "0",
      challenge: hex(randomBytes(32)),
      predicateId: hex(pureCircuits.predicateId(row.predicate))
    }
  }
}

export { presentationRequest }
