/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  if (typeof matchMedia !== 'function') {
    throw new Error('matchMedia is unavailable')
  }
  const noPreference = matchMedia('(prefers-reduced-motion: no-preference)')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const bare = matchMedia('(prefers-reduced-motion)')
  return {
    noPreference: { matches: noPreference.matches, media: noPreference.media },
    reduce: { matches: reduce.matches, media: reduce.media },
    bare: { matches: bare.matches, media: bare.media }
  }
}
