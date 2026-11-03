import type { RegistrySnapshotSourcePort } from "../../src/application/ports/registry_snapshot_source.port.ts"
import type { RegistryStateBytes } from "../../src/types/registry_state_bytes.type.ts"

class FakeRegistrySnapshotSource implements RegistrySnapshotSourcePort {
  readonly asked: string[] = []
  fails: Error | undefined

  async stateOf(contractAddress: string): Promise<RegistryStateBytes> {
    this.asked.push(contractAddress)

    if (this.fails !== undefined) {
      throw this.fails
    }

    return {
      contractState: new Uint8Array([1, this.asked.length]),
      zswapChainState: new Uint8Array([2]),
      ledgerParameters: new Uint8Array([3])
    }
  }
}

export default FakeRegistrySnapshotSource
