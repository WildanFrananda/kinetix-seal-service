import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"

import SettingReader from "../infrastructure/config/setting_reader.ts"
import { deriveWalletKeys } from "../infrastructure/midnight/wallet_keys.ts"
import { redactOutput } from "../infrastructure/observability/redacting_output.ts"

const read = new SettingReader(process.env)
const networkId = read.text("KINETIX_SEAL_NETWORK_ID")
const mnemonic = read.text("KINETIX_SEAL_SPONSOR_MNEMONIC").toLowerCase().split(/\s+/).join(" ")

read.verify()
redactOutput([{ value: mnemonic, placeholder: "<mnemonic>" }])
setNetworkId(networkId)

process.stdout.write(`${deriveWalletKeys(mnemonic).unshieldedKeystore.getBech32Address()}\n`)
