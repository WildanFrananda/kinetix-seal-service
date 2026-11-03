import type { BarcodeReader } from "../types/barcode_reader.type.ts"
import { decodeQr } from "./qr_decoder.ts"

const scanIntervalMilliseconds = 120

function nativeReader(): BarcodeReader | undefined {
  const detector: unknown = Reflect.get(globalThis, "BarcodeDetector")

  if (typeof detector !== "function") {
    return undefined
  }

  return Reflect.construct(detector, [{ formats: ["qr_code"] }])
}

class CameraScanner {
  private stream: MediaStream | undefined
  private running = false

  async start(video: HTMLVideoElement, onText: (text: string) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
    video.srcObject = this.stream
    video.setAttribute("playsinline", "")
    await video.play()
    this.running = true

    const canvas = document.createElement("canvas")

    await this.tick(video, canvas, nativeReader(), onText)
  }

  stop(): void {
    this.running = false

    for (const track of this.stream?.getTracks() ?? []) {
      track.stop()
    }

    this.stream = undefined
  }

  private async tick(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    reader: BarcodeReader | undefined,
    onText: (text: string) => void
  ): Promise<void> {
    if (!this.running) {
      return
    }

    if (video.readyState >= 2) {
      for (const text of await this.read(video, canvas, reader)) {
        onText(text)
      }
    }

    setTimeout(() => {
      void this.tick(video, canvas, reader, onText)
    }, scanIntervalMilliseconds)
  }

  private async read(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    reader: BarcodeReader | undefined
  ): Promise<string[]> {
    if (reader !== undefined) {
      return (await reader.detect(video)).map((code) => code.rawValue)
    }

    const context = canvas.getContext("2d", { willReadFrequently: true })

    if (context === null) {
      return []
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)

    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    const code = decodeQr(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })

    return code === null ? [] : [code.data]
  }
}

export default CameraScanner
