/** @type {{ pageOnly?: boolean }} */ (globalThis).pageOnly = true

function runProbe () {
  if (typeof FontFace !== 'function' || document.fonts == null) {
    throw new Error('FontFace is unavailable')
  }
  const faces = /** @type {Iterable<FontFace>} */ (document.fonts)
  /**
   * @param {string} name
   * @returns {boolean}
   */
  const squatted = (name) => {
    const needle = name.toLowerCase()
    for (const face of faces) {
      const family = face.family.replace(/["']/g, '').trim().toLowerCase()
      if (family === needle) {
        return true
      }
    }
    return false
  }
  return {
    arial: squatted('arial'),
    gillSans: squatted('gill sans'),
    helveticaNeue: squatted('helvetica neue'),
    menlo: squatted('menlo')
  }
}
