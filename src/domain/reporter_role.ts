import type { ReporterRole } from "../types/reporter_role.type.ts"

function reporterRoleOf(identityRole: string): ReporterRole | undefined {
  if (identityRole === "customer") {
    return "buyer"
  }

  if (identityRole === "courier") {
    return "courier"
  }

  return undefined
}

export { reporterRoleOf }
