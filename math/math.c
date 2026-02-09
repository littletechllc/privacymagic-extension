#include <math.h>
#include <stdbool.h>

// Math.hypot polyfill. Ported to C from V8 Torque: 
// https://source.chromium.org/chromium/chromium/src/+/main:v8/src/builtins/math.tq;drc=8a9b909801c729f2409db18e668b7db43241d8fe

double math_hypot(int count, double args[])
{
  if (count == 0)
    return 0.0;
  if (count == 1)
    return fabs(args[0]);

  double max = 0.0;
  bool one_arg_is_nan = false;

  // First pass: find max and handle Infinity/NaN
  for (int i = 0; i < count; i++)
  {
    double val = args[i];
    if (isnan(val))
    {
      one_arg_is_nan = true;
    }
    else
    {
      double abs_val = fabs(val);
      if (isinf(abs_val))
        return INFINITY;
      if (abs_val > max)
        max = abs_val;
    }
  }

  if (one_arg_is_nan)
    return NAN;
  if (max == 0.0)
    return 0.0;

  // Kahan Summation to avoid rounding errors
  // Normalized by 'max' to avoid overflow of (n*n)
  double sum = 0.0;
  double compensation = 0.0;

  for (int i = 0; i < count; i++)
  {
    double n = fabs(args[i]) / max;
    double summand = (n * n) - compensation;
    double preliminary = sum + summand;

    // This calculates the low-order bits of the sum lost in the addition
    compensation = (preliminary - sum) - summand;
    sum = preliminary;
  }

  return sqrt(sum) * max;
}