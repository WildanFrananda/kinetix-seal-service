const alphabet = /^[A-Za-z0-9_-]+$/

function bytesOfBase64Url(text: string): Uint8Array<ArrayBuffer> | undefined {
  if (!alphabet.test(text) || text.length % 4 === 1) {
    return undefined
  }

  const padding = "=".repeat((4 - (text.length % 4)) % 4)
  const binary = atob(`${text.replaceAll("-", "+").replaceAll("_", "/")}${padding}`)

  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export { bytesOfBase64Url }
