import type { GlobalScope } from './globalObject'
import { createSafeMethod, redefinePropertyValues } from './monkey-patch'
import { weakMapGetSafe, weakMapSetSafe } from './safe'

export type TrustedObjectType = TrustedHTML | TrustedScript | TrustedScriptURL

const trustedObjectsToPolicy = new WeakMap<TrustedObjectType, TrustedTypePolicy>()

export const prepareInjectionForTrustedTypes = (globalObject: GlobalScope, hardeningCode: string): void => {
  if (globalObject.TrustedTypePolicy == null || globalObject.TrustedTypePolicyFactory == null) {
    return
  }

  const createHTMLSafe = createSafeMethod(globalObject.TrustedTypePolicy, 'createHTML')
  const createScriptSafe = createSafeMethod(globalObject.TrustedTypePolicy, 'createScript')
  const createScriptURLSafe = createSafeMethod(globalObject.TrustedTypePolicy, 'createScriptURL')
  const createPolicySafe = createSafeMethod(globalObject.TrustedTypePolicyFactory, 'createPolicy')

  // Modify the TrustedTypePolicy prototype to keep track of the trusted type policy
  // that generated each trusted object.
  redefinePropertyValues(globalObject.TrustedTypePolicy.prototype, {
    createHTML: function (this: TrustedTypePolicy, input: string): TrustedHTML {
      const trustedHTML = createHTMLSafe(this, input)
      weakMapSetSafe(trustedObjectsToPolicy, trustedHTML, this)
      return trustedHTML
    },
    createScript: function (this: TrustedTypePolicy, input: string): TrustedScript {
      const trustedScript = createScriptSafe(this, input)
      weakMapSetSafe(trustedObjectsToPolicy, trustedScript, this)
      return trustedScript
    },
    createScriptURL: function (this: TrustedTypePolicy, input: string): TrustedScriptURL {
      const trustedScriptURL = createScriptURLSafe(this, input)
      weakMapSetSafe(trustedObjectsToPolicy, trustedScriptURL, this)
      return trustedScriptURL
    }
  })

  // Modify the TrustedTypePolicyFactory prototype to create a trusted type policy
  // that will pass the hardening code unchanged into a TrustedScript.
  redefinePropertyValues(globalObject.TrustedTypePolicyFactory.prototype, {
    createPolicy: function (
      this: TrustedTypePolicyFactory, policyName: string, policyOptions: TrustedTypePolicyOptions
    ): TrustedTypePolicy {
      if (policyOptions.createScript == null) {
        return createPolicySafe(this, policyName, policyOptions)
      }
      const originalCreateScript = policyOptions.createScript
      return createPolicySafe(this, policyName, {
        ...policyOptions,
        createScript: (input: string | TrustedScript) => {
          if (input === hardeningCode) {
            return input
          }
          if (typeof input !== 'string') {
            return input
          }
          return originalCreateScript(input)
        }
      })
    }
  })
}

export const getTrustedTypePolicyForObject = (object: TrustedObjectType): TrustedTypePolicy | undefined => {
  return weakMapGetSafe(trustedObjectsToPolicy, object)
}
