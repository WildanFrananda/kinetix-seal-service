import qrcode from "qrcode-generator"

function qrMatrix(text: string): boolean[][] {
  const code = qrcode(0, "M")

  code.addData(text)
  code.make()

  const size = code.getModuleCount()

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (__, column) => code.isDark(row, column))
  )
}

export { qrMatrix }
