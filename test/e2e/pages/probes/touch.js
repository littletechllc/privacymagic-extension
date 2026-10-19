/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  const value = navigator.maxTouchPoints
  return {
    present: 'maxTouchPoints' in navigator,
    maxTouchPoints: value === undefined ? 'undefined' : value
  }
}
