const millisecondsPerDay = 86_400_000

function issueDayOf(at: Date): number {
  return Math.floor(at.getTime() / millisecondsPerDay)
}

export { issueDayOf }
