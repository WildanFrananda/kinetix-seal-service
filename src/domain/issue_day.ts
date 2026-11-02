const millisecondsPerDay = 86_400_000

function issueDayOf(at: Date): number {
  return Math.floor(at.getTime() / millisecondsPerDay)
}

function dateOfIssueDay(day: number): string {
  return new Date(day * millisecondsPerDay).toISOString().slice(0, 10)
}

export { dateOfIssueDay, issueDayOf }
