/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  const posture = navigator.devicePosture
  if (posture == null) {
    throw new Error('navigator.devicePosture is unavailable')
  }
  posture.onchange = () => {}
  posture.addEventListener('change', () => {})
  const onchange = posture.onchange
  return {
    type: posture.type,
    onchange: typeof onchange === 'function' ? 'function' : onchange
  }
}
