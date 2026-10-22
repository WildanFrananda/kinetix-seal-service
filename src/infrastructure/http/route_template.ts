function routeTemplate(matched: string | undefined): string {
  if (matched === undefined || matched === "") {
    return "unmatched"
  }

  return matched.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}")
}

export { routeTemplate }
