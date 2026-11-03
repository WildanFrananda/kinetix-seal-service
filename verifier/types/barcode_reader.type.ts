type BarcodeReader = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

export type { BarcodeReader }
