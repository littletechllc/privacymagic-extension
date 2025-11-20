/* global Math */

const math = () => {
  const LOW_BITS = 8;

  // Shared buffer for bit manipulation
  const buf = new ArrayBuffer(8);
  const f64 = new Float64Array(buf);
  const u32 = new Uint32Array(buf);

  const MASK = ~((1 << LOW_BITS) - 1) >>> 0;

  const roundMantissaLSB = (fn) => {
    return function (x) {
      f64[0] = fn(x);
      // zero the lowest `LOW_BITS` of the mantissa
      u32[0] &= MASK;
      return f64[0];
    };
  };

  const mathFunctions = [
    'acos', 'acosh',
    'asin', 'asinh',
    'atan', 'atanh', 'atan2',
    'sin', 'sinh',
    'cos', 'cosh',
    'tan', 'tanh',
    'exp', 'expm1',
    'log', 'log1p',
    'pow', 'sqrt'];

  for (const name of mathFunctions) {
    if (typeof Math[name] === 'function') {
      Math[name] = roundMantissaLSB(Math[name]);
    }
  }
};

export default math;
