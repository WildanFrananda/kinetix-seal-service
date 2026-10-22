import type { RedactedSecret } from "../../types/redacted_secret.type.ts"

function redacted(text: string, secrets: readonly RedactedSecret[]): string {
  return secrets.reduce((current, secret) => current.split(secret.value).join(secret.placeholder), text)
}

function redactOutput(secrets: readonly RedactedSecret[]): void {
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream) as (chunk: string, ...rest: unknown[]) => boolean

    function redactedWrite(chunk: unknown, ...rest: unknown[]): boolean {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8")

      return write(redacted(text, secrets), ...rest)
    }

    stream.write = redactedWrite as typeof stream.write
  }
}

export { redacted, redactOutput }
