function runProbe () {
  const languages = Array.from(navigator.languages)
  const first = languages[0] ?? ''
  const base = first.split('-')[0].toLowerCase()
  return {
    language: navigator.language,
    first,
    count: languages.length,
    onlyFirstBase: languages.length > 0 && languages.every((tag, index) =>
      index === 0 || tag.toLowerCase() === base
    )
  }
}
