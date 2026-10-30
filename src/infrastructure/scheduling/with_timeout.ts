async function withTimeout<T>(work: Promise<T>, seconds: number, step: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${step} timed out after ${seconds} s`))
    }, seconds * 1000)
  })

  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

export { withTimeout }
