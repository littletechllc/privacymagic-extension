import * as mathJs from '@math/math.min.js'
import type { GlobalScope } from '../helpers/globalObject'
import { redefineMethods } from '../helpers/monkey-patch'

const math = (globalObject: GlobalScope): void => {

  const hypot = (...args: number[]): number => {
    if (args.length === 0) {
      return 0
    }
    if (args.length === 1) {
      return Math.abs(args[0])
    }
    let max = 0
    let hasNaN = false
    for (const x of args) {
      if (isNaN(x)) {
        hasNaN = true
        continue
      }
      const abs = Math.abs(x)
      if (abs > max) {
        max = abs
      }
    }
    if (!isFinite(max)) {
      return Infinity
    }
    if (hasNaN) {
      return NaN
    }
    if (max === 0) {
      return 0
    }
    let sum = 0
    for (const x of args) {
      const scaled = x / max
      sum = sum + scaled * scaled
    }
    return max * Math.sqrt(sum)
  }

  const { _emscripten_stack_restore, emscripten_stack_get_current, memory, ...limitedMathJs } = mathJs
  redefineMethods(globalObject.Math, { ...limitedMathJs, hypot })

}

export default math
