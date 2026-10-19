function runProbe () {
  const nav = /** @type {Navigator & { globalPrivacyControl?: boolean }} */ (navigator)
  nav.globalPrivacyControl = false
  return {
    present: 'globalPrivacyControl' in nav,
    globalPrivacyControl: nav.globalPrivacyControl
  }
}
