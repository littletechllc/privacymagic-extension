import mathWasmBase64 from '@math/math.wasm'

const math = (): void => {
  type MathFunctionName = keyof Math
  type MathFunction = (...args: number[]) => number

  // CI may not resolve @math/math.wasm to the .d.ts; assert string so lint passes everywhere
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const mathWasmBuffer = Uint8Array.fromBase64(mathWasmBase64 as string)
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
    const exports = mathWasmExports as {
      memory: WebAssembly.Memory
      malloc: (bytes: number) => number
      free: (ptr: number) => void
      math_hypot: (count: number, ptr: number) => number
    }
    const ptr = exports.malloc(len * 8)
    new Float64Array(exports.memory.buffer, ptr, len).set(args)
    const result = exports.math_hypot(len, ptr)
    exports.free(ptr)
    return result
  }

  redefineMathFunction('hypot', hypot)
}

export default math
