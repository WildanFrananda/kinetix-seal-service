import type { DatabaseProbePort } from "../../src/application/ports/database_probe.port.ts"

class FakeDatabaseProbe implements DatabaseProbePort {
  answer: boolean

  constructor(answer: boolean) {
    this.answer = answer
  }

  async reachable(): Promise<boolean> {
    return this.answer
  }
}

export default FakeDatabaseProbe
