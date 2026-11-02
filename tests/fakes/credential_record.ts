import { courierClassId } from "../../src/domain/credential_classes.ts"
import type { CredentialRecord } from "../../src/types/credential_record.type.ts"

function credentialRecord(overrides: Partial<CredentialRecord>): CredentialRecord {
  return {
    id: "0b6f6a0e-3c1f-4d2a-9a51-6f1c2d3e4f50",
    principalId: "drv_1",
    classId: courierClassId,
    attributes: [12n, 450n, 30n, 20_759n],
    salt: new Uint8Array(32).fill(7),
    holderPublicKey: 123_456_789n,
    issueDay: 20_759,
    requestedAt: new Date("2026-11-02T03:00:00Z"),
    ...overrides
  }
}

export { credentialRecord }
