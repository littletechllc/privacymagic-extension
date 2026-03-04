/**
 * Browser globals used by patches.
 * Patches must use only `globalObject.XXX` (no bare `self.`, `window.`, or global names).
 *
 * GlobalScope is typeof self; extended constructor properties (BatteryManager,
 * TrustedScriptURL, etc.) are declared on Window/WorkerGlobalScope in window-extensions.d.ts.
 */
export type GlobalScope = typeof self

/**
 * Returns Navigator constructor (window) or WorkerNavigator constructor (worker).
 * Throws if neither exists.
 */
export function getNavigatorConstructor(globalObject: GlobalScope): GlobalScope['Navigator'] | GlobalScope['WorkerNavigator'] {
  const NavigatorConstructor = globalObject.Navigator ?? globalObject.WorkerNavigator
  if (NavigatorConstructor == null) {
    throw new Error('Navigator constructor not found')
  }
  return NavigatorConstructor
}
