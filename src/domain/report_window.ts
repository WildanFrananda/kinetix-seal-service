function reportWindowOf(at: Date): number {
  return (at.getUTCFullYear() - 1970) * 12 + at.getUTCMonth()
}

export { reportWindowOf }
