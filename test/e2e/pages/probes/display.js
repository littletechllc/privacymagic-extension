/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

/**
 * @param {string} query
 * @returns {{ matches: boolean, media: string }}
 */
function readQuery (query) {
  const list = matchMedia(query)
  return { matches: list.matches, media: list.media }
}

function runProbe () {
  if (typeof matchMedia !== 'function') {
    throw new Error('matchMedia is unavailable')
  }
  return {
    noPreference: readQuery('(prefers-reduced-motion: no-preference)'),
    reduce: readQuery('(prefers-reduced-motion: reduce)'),
    bare: readQuery('(prefers-reduced-motion)'),
    contrastNoPreference: readQuery('(prefers-contrast: no-preference)'),
    contrastMore: readQuery('(prefers-contrast: more)'),
    contrastLess: readQuery('(prefers-contrast: less)'),
    contrastCustom: readQuery('(prefers-contrast: custom)'),
    contrastBare: readQuery('(prefers-contrast)'),
    transparencyNoPreference: readQuery('(prefers-reduced-transparency: no-preference)'),
    transparencyReduce: readQuery('(prefers-reduced-transparency: reduce)'),
    transparencyBare: readQuery('(prefers-reduced-transparency)')
  }
}
