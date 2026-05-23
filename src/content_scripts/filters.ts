import { SCRIPTLET_COOKIE_KEY } from '@src/common/setting-ids'

import { ScriptletCommand } from '@src/common/scriptlet-names'

const fromBase64 = (s: string): string => {
  return Buffer.from(s, 'base64').toString('utf-8')
}

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
  const removeClass = (element: Element) => {
    if (element.matches(selector)) {
      element.classList.remove(className)
    }
  }
  const removeClassInTree = (element: Element) => {
    removeClass(element)
    element.querySelectorAll(selector).forEach(removeClass)
  }
  removeClassInTree(document.documentElement)
  if (command?.includes('stay')) {
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof Element) {
              removeClassInTree(node)
            }
          })
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          removeClassInTree(mutation.target as Element)
        }
      })
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
  }
}

const setLocalStorageItem = (key: string, value: unknown): void => {
  localStorage.setItem(key, value as string)
}

const setSessionStorageItem = (key: string, value: unknown): void => {
  sessionStorage.setItem(key, value as string)
}

const splitAtFirst = (s: string, separator: string): [string, string] => {
  const index = s.indexOf(separator)
  if (index === -1) {
    return [s, '']
  }
  return [s.substring(0, index), s.substring(index + separator.length)]
}

const getScriptletCommands = (): ScriptletCommand[] | undefined => {
  for (const cookie of document.cookie.split(';')) {
    const [key, value] = splitAtFirst(cookie, '=')
    if (key.trim() === SCRIPTLET_COOKIE_KEY) {
      // Decode base64 encoded JSON:
      try {
        const decodedCommands = fromBase64(value.trim())
        return JSON.parse(decodedCommands) as ScriptletCommand[]
      } catch (error) {
        console.error('error parsing scriptlet commands:', error)
        return undefined
      }
    }
  }
  return undefined
}

const clearCookieScriptletCommands = (): void => {
  document.cookie = `${SCRIPTLET_COOKIE_KEY}=; Secure; SameSite=None; Path=/; Partitioned`
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

const main = () => {
  const commands = getScriptletCommands()
  clearCookieScriptletCommands()
  if (commands) {
    executeScriptletCommands(commands)
  }
}

main()