function withProjectId(base: string, projectId: string): string {
  const url = new URL(base)

  url.searchParams.set("project_id", projectId)

  return url.toString()
}

export { withProjectId }
