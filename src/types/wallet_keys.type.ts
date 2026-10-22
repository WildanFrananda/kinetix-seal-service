import type { deriveWalletKeys } from "../infrastructure/midnight/wallet_keys.ts"

type WalletKeys = ReturnType<typeof deriveWalletKeys>

export type { WalletKeys }
