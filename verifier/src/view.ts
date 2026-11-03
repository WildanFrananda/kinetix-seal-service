function element(tag: string, text?: string, className?: string): HTMLElement {
  const created = document.createElement(tag)

  if (text !== undefined) {
    created.textContent = text
  }

  if (className !== undefined) {
    created.className = className
  }

  return created
}

function button(text: string, onClick: () => void, className = "action"): HTMLButtonElement {
  const created = document.createElement("button")

  created.type = "button"
  created.className = className
  created.textContent = text
  created.addEventListener("click", onClick)

  return created
}

function qrSvg(matrix: readonly boolean[][]): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg"
  const size = matrix.length + 8
  const svg = document.createElementNS(namespace, "svg")

  svg.setAttribute("viewBox", `0 0 ${size} ${size}`)
  svg.setAttribute("class", "code")
  svg.setAttribute("role", "img")
  svg.setAttribute("aria-label", "Code for the courier's app")

  const background = document.createElementNS(namespace, "rect")

  background.setAttribute("width", String(size))
  background.setAttribute("height", String(size))
  background.setAttribute("fill", "#fff")
  svg.append(background)

  for (const [row, cells] of matrix.entries()) {
    for (const [column, dark] of cells.entries()) {
      if (dark) {
        const cell = document.createElementNS(namespace, "rect")

        cell.setAttribute("x", String(column + 4))
        cell.setAttribute("y", String(row + 4))
        cell.setAttribute("width", "1")
        cell.setAttribute("height", "1")
        svg.append(cell)
      }
    }
  }

  return svg
}

export { button, element, qrSvg }
