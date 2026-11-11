import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"

import { Contract } from "#contracts/report_registry/contract/index.js"
import type { ReportRegistryPrivateState } from "../../types/report_registry_private_state.type.ts"
import { reportRegistryWitnesses } from "./report_registry_witnesses.ts"

const reportRegistryDirectory = dirname(
  dirname(fileURLToPath(import.meta.resolve("#contracts/report_registry/compiler/contract-info.json")))
)

function compileReportRegistry() {
  return CompiledContract.make<Contract<ReportRegistryPrivateState>>("report_registry", Contract).pipe(
    CompiledContract.withWitnesses(reportRegistryWitnesses),
    CompiledContract.withCompiledFileAssets(reportRegistryDirectory)
  )
}

export { compileReportRegistry, reportRegistryDirectory }
