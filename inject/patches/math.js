/* global Math */

const math = () => {
  // Ensure that LOW_BITS is in (0,32)
  const LOW_BITS = 8;

  if (LOW_BITS < 1 || LOW_BITS > 31) {
    throw new Error('LOW_BITS must be an integer between 1 and 31');
  }

  const isLittleEndian = (() => {
    const buffer = new ArrayBuffer(4);
    const u32 = new Uint32Array(buffer);
    const u8 = new Uint8Array(buffer);

    u32[0] = 0x01020304;

    return u8[0] === 0x04;
  })();

  const LOW_INDEX = isLittleEndian ? 0 : 1; // index of low 32 bits

  // Shared buffer for bit manipulation
  const buf = new ArrayBuffer(8);
  const f64 = new Float64Array(buf);
  const u32 = new Uint32Array(buf);

  // Mask to zero the lowest `LOW_BITS` of the mantissa
  const MASK = (0xFFFFFFFF << LOW_BITS) >>> 0;

  // Likely non-deterministic Math.* functions that take a single argument
  // and return a floating point number
  const singleArgFunctions = [
    'acos',
    'acosh',
    'asin',
    'asinh',
    'atan',
    'atanh',
    'cbrt',
    'cos',
    'cosh',
    'exp',
    'expm1',
    'log',
    'log1p',
    'log2',
    'log10',
    'sin',
    'sinh',
    'sqrt',
    'tan',
    'tanh'
  ];

  const roundSingleArgFunction = (fn) => {
    return function (x) {
      f64[0] = fn(x);
      // zero the lowest `LOW_BITS` of the mantissa
      u32[LOW_INDEX] &= MASK;
      return f64[0];
    };
  };

  for (const name of singleArgFunctions) {
    if (typeof Math[name] === 'function') {
      Math[name] = roundSingleArgFunction(Math[name]);
    }
  }

  // Likely non-deterministic Math.* functions that take multiple arguments
  // and return a floating point number
  const multiArgFunctions = [
    'atan2',
    'hypot',
    'pow'
  ];

  const roundMultiArgFunction = (fn) => {
    return function (...args) {
      f64[0] = fn(...args);
      // zero the lowest `LOW_BITS` of the mantissa
      u32[LOW_INDEX] &= MASK;
      return f64[0];
    };
  };

  for (const name of multiArgFunctions) {
    if (typeof Math[name] === 'function') {
      Math[name] = roundMultiArgFunction(Math[name]);
    }
  }
};

export default math;
