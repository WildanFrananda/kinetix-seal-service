import { existsSync } from "node:fs"
import { readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { WalletFacade } from "@midnightntwrk/wallet-sdk"

import type { SavedWalletState } from "../../types/saved_wallet_state.type.ts"
import type { WalletKeys } from "../../types/wallet_keys.type.ts"

function walletStateFile(directory: string, keys: WalletKeys): string {
  return join(directory, `wallet-state-${keys.unshieldedKeystore.getBech32Address()}.json`)
}

async function loadWalletState(file: string): Promise<SavedWalletState | undefined> {
  if (!existsSync(file)) {
    return undefined
  }

  return JSON.parse(await readFile(file, "utf8")) as SavedWalletState
}

async function saveWalletState(wallet: WalletFacade, file: string): Promise<void> {
  const snapshot: SavedWalletState = {
    shielded: await wallet.shielded.serializeState(),
    unshielded: await wallet.unshielded.serializeState(),
    dust: await wallet.dust.serializeState()
  }

  await writeFile(`${file}.tmp`, JSON.stringify(snapshot), { mode: 0o600 })
  await rename(`${file}.tmp`, file)
}

export { loadWalletState, saveWalletState, walletStateFile }
