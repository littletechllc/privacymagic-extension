import { SCRIPTLET_COOKIE_KEY } from '@src/common/setting-ids'
import { jsonFromBase64 } from '@src/common/base64'
import { ScriptletCommand } from '@src/common/scriptlet-names'
import { observeSubtreeMutations, queryCssSelectorAll, splitAtFirst } from './filter-util'

const constantValueFrom = (value: string): unknown => {
  switch (value) {
    case 'undefined': return undefined
    case 'null': return null
    case 'true': return true
    case 'false': return false
    case 'noopFunc': return () => {}
    case 'trueFunc': return () => true
    case 'falseFunc': return () => false
    case '[]': return []
    case '{}': return {}
    default: return isNaN(Number(value)) ? value : Number(value)
  }
}

const setConstant = (path: string, value: string): void => {
  const normalizedValue = constantValueFrom(value)
  const parts = path.split('.');
  let obj: Record<string, unknown> = self as unknown as Record<string, unknown>;
  for (let i: number = 0; i < parts.length - 1; ++i) {
    if (obj[parts[i]] == null) {
      obj[parts[i]] = {};
    }
    obj = obj[parts[i]] as Record<string, unknown>;
  }
  Object.defineProperty(obj, parts[parts.length - 1], {
    get: () => normalizedValue,
    configurable: false
  });
};

const removeClass = (className: string, selector: string, command?: string): void => {
  const removeClassInTree = (root: Element) => {
    for (const element of queryCssSelectorAll(root, selector)) {
      element.classList.remove(className)
    }
  }
  removeClassInTree(document.documentElement)
  if (command?.includes('stay')) {
    observeSubtreeMutations((node: Element) => {
      removeClassInTree(node)
    })
  }
}

const setLocalStorageItem = (key: string, value: unknown): void => {
  localStorage.setItem(key, value as string)
}

const setSessionStorageItem = (key: string, value: unknown): void => {
  sessionStorage.setItem(key, value as string)
}

const getScriptletCommands = (): ScriptletCommand[] | undefined => {
  for (const cookie of document.cookie.split(';')) {
    const [key, value] = splitAtFirst(cookie, '=')
    if (key.trim() === SCRIPTLET_COOKIE_KEY) {
      // Decode base64 encoded JSON:
      try {
        return jsonFromBase64(value.trim()) as ScriptletCommand[]
      } catch (error) {
        console.error('error parsing scriptlet commands:', error)
        return undefined
      }
    }
  }
  return undefined
}

const clearCookieScriptletCommands = (): void => {
  document.cookie = `${SCRIPTLET_COOKIE_KEY}=; Max-Age=0; Secure; SameSite=None; Path=/; Partitioned`
}

const executeScriptletCommands = (commands: ScriptletCommand[]): void => {
  commands.forEach((command: ScriptletCommand) => {
    const [commandName, ...args] = command
    switch (commandName) {
      case 'set-constant':
        setConstant(args[0], args[1])
        break
      case 'remove-class':
        removeClass(args[0], args[1], args[2])
        break
      case 'set-local-storage-item':
        setLocalStorageItem(args[0], args[1])
        break
      case 'set-session-storage-item':
        setSessionStorageItem(args[0], args[1])
        break
      default:
        console.log(`unsupported scriptlet command: ${commandName}`)
        break
    }
  })
}

export const activateScriptlets = () => {
  const commands = getScriptletCommands()
  clearCookieScriptletCommands()
  if (commands) {
    executeScriptletCommands(commands)
  }
}
