import mathWasmBase64 from '@math/math.wasm'

const math = (): void => {
  type MathFunctionName = keyof Math
  type MathFunction = (...args: number[]) => number

  const mathWasmBuffer = Uint8Array.fromBase64(mathWasmBase64)
  const mathWasmModule = new WebAssembly.Module(mathWasmBuffer)
  const mathWasmInstance = new WebAssembly.Instance(mathWasmModule)
  const mathWasmExports = mathWasmInstance.exports

  const mathFunctionNames: readonly MathFunctionName[] = [
    'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'cos', 'cosh',
    'exp', 'expm1', 'log', 'log10', 'log1p', 'log2', 'pow', 'sin', 'sinh',
    'sqrt', 'tan', 'tanh'
  ]

  const redefineMathFunction = (name: MathFunctionName, value: MathFunction): void => {
    Object.defineProperty(Math, name, {
      value: value,
      writable: true,
      configurable: true
    })
  }

  for (const name of mathFunctionNames) {
    redefineMathFunction(name, mathWasmExports[name as string] as MathFunction)
  }

  const hypot = (...args: number[]): number => {
    const len = args.length
    if (len === 0) {
      return 0
    }
    if (len === 1) {
      return args[0]
    }
    const exports = mathWasmExports as {
      memory: WebAssembly.Memory
      malloc: (bytes: number) => number
      free: (ptr: number) => void
      math_hypot: (count: number, ptr: number) => number
    }
    const ptr = exports.malloc(len * Float64Array.BYTES_PER_ELEMENT)
    new Float64Array(exports.memory.buffer, ptr, len).set(args)
    const result = exports.math_hypot(len, ptr)
    exports.free(ptr)
    return result
  }

  redefineMathFunction('hypot', hypot)
}

export default math
