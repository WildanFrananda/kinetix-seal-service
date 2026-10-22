function repeat(seconds: number, task: () => Promise<void>): () => void {
  let stopped = false
  let timer: NodeJS.Timeout | undefined

  async function run(): Promise<void> {
    await task()

    if (!stopped) {
      timer = setTimeout(run, seconds * 1000)
    }
  }

  function stop(): void {
    stopped = true
    clearTimeout(timer)
  }

  timer = setTimeout(run, 0)

  return stop
}

export { repeat }
