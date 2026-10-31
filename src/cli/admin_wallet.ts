import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import type { WalletFacade } from "@midnightntwrk/wallet-sdk"

import type { LoggerPort } from "../application/ports/logger.port.ts"
import { readSponsorConfig } from "../infrastructure/config/read_sponsor_config.ts"
import { sponsorSecrets } from "../infrastructure/midnight/seal_secrets.ts"
import { startWalletFacade } from "../infrastructure/midnight/wallet_facade_factory.ts"
import { deriveWalletKeys } from "../infrastructure/midnight/wallet_keys.ts"
import { loadWalletState, saveWalletState, walletStateFile } from "../infrastructure/midnight/wallet_state_file.ts"
import JsonLogger from "../infrastructure/observability/json_logger.ts"
import { redactOutput } from "../infrastructure/observability/redacting_output.ts"
import type { WalletKeys } from "../types/wallet_keys.type.ts"

async function withAdminWallet(
  command: string,
  task: (wallet: WalletFacade, keys: WalletKeys, logger: LoggerPort) => Promise<void>
): Promise<void> {
  const config = readSponsorConfig(process.env)

  redactOutput(sponsorSecrets(config))
  setNetworkId(config.midnight.networkId)

  const logger = new JsonLogger(`kinetix-seal-${command}`, config.logLevel, (line) => {
    process.stdout.write(line)
  })

  const keys = deriveWalletKeys(config.sponsorMnemonic)
  const stateFile = walletStateFile(config.walletStateDir, keys)
  const wallet = await startWalletFacade(
    config.midnight,
    config.blockfrostProjectId,
    keys,
    await loadWalletState(stateFile)
  )

  try {
    await wallet.waitForSyncedState()
    logger.info({ message: "the sponsor wallet is synced" })
    await task(wallet, keys, logger)
    await saveWalletState(wallet, stateFile)
  } catch (error) {
    logger.error({ message: `${command} failed` }, error)
    process.exitCode = 1
  } finally {
    await wallet.stop()
  }
}

export { withAdminWallet }
