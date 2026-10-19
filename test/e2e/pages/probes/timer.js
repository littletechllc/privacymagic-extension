function runProbe () {
  const first = performance.now()
  const until = Date.now() + 30
  while (Date.now() < until) {
    // Wait long enough that a rounded millisecond clock must move.
  }
  const second = performance.now()
  return {
    nowInteger: Number.isInteger(first) && Number.isInteger(second),
    nowAdvanced: second > first,
    timeOriginInteger: Number.isInteger(performance.timeOrigin)
  }
}
