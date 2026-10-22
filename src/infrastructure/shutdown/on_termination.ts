function onTermination(graceSeconds: number, drain: () => Promise<void>, failed: (error: unknown) => void): void {
  let draining = false

  function stop(): void {
    if (draining) {
      return
    }

    draining = true

    const deadline = setTimeout(() => {
      failed(new Error(`shutdown did not finish within ${graceSeconds} s`))
      process.exit(1)
    }, graceSeconds * 1000)

    drain()
      .then(() => {
        clearTimeout(deadline)
        process.exit(0)
      })
      .catch((error: unknown) => {
        failed(error)
        process.exit(1)
      })
  }

  process.once("SIGTERM", stop)
  process.once("SIGINT", stop)
}

export { onTermination }
