type Unary = (x: number) => number
type Binary = (x: number, y: number) => number

export const acos: Unary
export const acosh: Unary
export const asin: Unary
export const asinh: Unary
export const atan: Unary
export const atan2: Binary
export const atanh: Unary
export const cbrt: Unary
export const cos: Unary
export const cosh: Unary
export const exp: Unary
export const expm1: Unary
export const log: Unary
export const log10: Unary
export const log1p: Unary
export const log2: Unary
export const pow: Binary
export const sin: Unary
export const sinh: Unary
export const sqrt: Unary
export const tan: Unary
export const tanh: Unary

export function _emscripten_stack_restore(ptr: number): void
export function emscripten_stack_get_current(): number
export const memory: WebAssembly.Memory