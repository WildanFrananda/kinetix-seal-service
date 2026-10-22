interface DatabaseProbePort {
  reachable(): Promise<boolean>
}

export type { DatabaseProbePort }
