function runProbe () {
  const first = navigator.hardwareConcurrency
  const second = navigator.hardwareConcurrency
  return {
    hardwareConcurrency: first,
    stable: first === second
  }
}
