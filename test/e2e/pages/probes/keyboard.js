/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  const nav = /** @type {Navigator & { keyboard?: object }} */ (navigator)
  if (!('keyboard' in nav)) {
    throw new Error('navigator.keyboard is unavailable')
  }
  const value = nav.keyboard
  return {
    present: true,
    keyboard: value === undefined ? 'undefined' : 'defined'
  }
}
