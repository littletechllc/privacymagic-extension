import fs from 'node:fs/promises'
import path from 'node:path'
import { entries } from '../util'

export type ScriptletInvocation = {
  domains: string[]
  body: string
}

export const isScriptletLine = (line: string): boolean => {
  return line.includes('##+js(')
}

const constantValueFrom = (value: string): string => {
  switch (value) {
    case 'noopFunc':
      return `(() => {})`
    case 'trueFunc':
      return `(() => true)`
    default:
      return value
  }
}

const setConstantFunction = (path: string, value: unknown): void => {
  const parts = path.split('.');
  let obj: Record<string, unknown> = self as unknown as Record<string, unknown>;
  for (let i: number = 0; i < parts.length - 1; ++i) {
    if (obj[parts[i]] == null) {
      obj[parts[i]] = {};
    }
    obj = obj[parts[i]] as Record<string, unknown>;
  }
  Object.defineProperty(obj, parts[parts.length - 1], {
    get: () => value,
    configurable: false
  });
};

const removeClassFunction = (className: string, selector: string, command?: string): void => {
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

const generateScriptlet = (scriptletArguments: string[]): string | undefined => {
  const scriptletName = scriptletArguments[0]
  switch (scriptletName) {
    case 'set-cookie':
    case 'set-cookie-reload':
      return `document.cookie = '${scriptletArguments[1]}=${scriptletArguments[2]}; path=/';`
    case 'remove-cookie':
    case 'cookie-remover':
    case 'cookie-remover.js':
      return `document.cookie = '${scriptletArguments[1]}=; path=/';`
    case 'set-local-storage-item':
      return `localStorage.setItem('${scriptletArguments[1]}', '${scriptletArguments[2]}');`
    case 'set-session-storage-item':
      return `sessionStorage.setItem('${scriptletArguments[1]}', '${scriptletArguments[2]}');`
    case 'set':
    case 'set-constant':
      return `(${setConstantFunction.toString()})('${scriptletArguments[1]}', ${constantValueFrom(scriptletArguments[2])});`
    case 'remove-class':
    case 'rc':
      return `(${removeClassFunction.toString()})(${JSON.stringify(scriptletArguments[1])}, ${JSON.stringify(scriptletArguments[2])}, ${JSON.stringify(scriptletArguments[3])});`
    default:
      console.log('unsupported scriptlet', scriptletArguments)
      return undefined
  }
}

export const parseScriptletLine = (line: string): ScriptletInvocation | undefined => {
  const matches = line.match(/(.*?)##\+js\((.*?)\)/i)
  if (!Array.isArray(matches) || matches.length < 3) {
    return undefined
  }
  // TODO: handle asterisks in domains
  const domains = matches[1].split(',').filter(d => !d.endsWith('*'))
  const scriptletArguments = matches[2].split(',').map(s => s.trim())
  const scriptletBody = generateScriptlet(scriptletArguments)
  if (scriptletBody === undefined) {
    return undefined
  }
  return { domains, body: scriptletBody }
}

export const generateScriptletFiles = async (dir: string, scriptlets: ScriptletInvocation[]): Promise<void> => {
  const scriptletsForDomains: Record<string, string> = {}
  await fs.mkdir(dir, { recursive: true })
  for (const scriptletRule of scriptlets) {
    for (const domain of scriptletRule.domains) {
      if (scriptletsForDomains[domain] === undefined) {
        scriptletsForDomains[domain] = ''
      }
      scriptletsForDomains[domain] += `${scriptletRule.body}\n`
    }
  }
  for (const [domain, scriptlet] of entries(scriptletsForDomains)) {
    const file = `${domain}_.js`
    await fs.writeFile(path.join(dir, file), scriptlet)
  }
  await fs.writeFile(path.join(dir, 'index.txt'), Object.keys(scriptletsForDomains).sort().join('\n'))
}
