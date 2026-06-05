import { SCRIPTLET_RULES_FILE, FILTER_LIST_DIR } from '@src/common/filter-list-paths'
import { entries } from '../util'
import { writeFile, appendCookieRule, removeCookieRule } from './util'
import { SCRIPTLET_COOKIE_KEY } from '@src/common/setting-ids'
import { ScriptletName, ScriptletCommand } from '@src/common/scriptlet-names'
import { domainToASCII } from 'node:url'
import { jsonToBase64 } from '@src/common/base64'

/** DNR urlFilter must be ASCII; IDN labels from filter lists are punycode-encoded. */
const toAsciiDomain = (domain: string): string | undefined => {
  const trimmed = domain.trim()
  if (trimmed === '') {
    return undefined
  }
  const ascii = domainToASCII(trimmed)
  // DNR urlFilter hostnames must be ASCII. Reject failed conversions and any
  // leftover non-ASCII: [\x21-\x7E] is printable ASCII from '!' through '~'.
  if (ascii === '' || !/^[\x21-\x7E]+$/.test(ascii)) {
    return undefined
  }
  return ascii
}

const normalizeScriptletName = (scriptletName: string): ScriptletName | undefined => {
  switch (scriptletName) {
    case 'set-cookie':
    case 'set-cookie-reload':
      return 'set-cookie'
    case 'remove-cookie':
    case 'cookie-remover':
    case 'cookie-remover.js':
      return 'remove-cookie'
    case 'set-local-storage-item':
      return 'set-local-storage-item'
    case 'set-session-storage-item':
      return 'set-session-storage-item'
    case 'set':
    case 'set-constant':
      return 'set-constant'
    case 'remove-class':
    case 'rc':
      return 'remove-class'
    default:
      console.log('unsupported scriptlet', scriptletName)
      return undefined
  }
}

const normalizeScriptletCommand = (scriptletCommand: string[]): ScriptletCommand | undefined => {
  const scriptletName = normalizeScriptletName(scriptletCommand[0])
  if (scriptletName === undefined) {
    return undefined
  }
  const args = scriptletCommand.slice(1)
  return [scriptletName, ...args]
}


const parseScriptletLine = (line: string): { domains: string[], command: ScriptletCommand } | undefined => {
  const matches = line.match(/(.*?)##\+js\((.*?)\)/i)
  if (!Array.isArray(matches) || matches.length < 3) {
    return undefined
  }
  // TODO: handle asterisks in domains
  const domains = matches[1]
    .split(',')
    .filter((d) => !d.endsWith('*'))
    .map((d) => toAsciiDomain(d))
    .filter((d): d is string => d !== undefined)
  const scriptletArguments = matches[2].split(',').map(s => s.trim())
  const scriptletCommand = normalizeScriptletCommand(scriptletArguments)
  if (scriptletCommand === undefined || domains.length === 0) {
    return undefined
  }
  return { domains, command: scriptletCommand }
}

const collectScriptletsForDomains = (lines: string[]): Record<string, ScriptletCommand[]> => {
  const scriptletsForDomains: Record<string, ScriptletCommand[]> = {}
  for (const line of lines) {
    const scriptlet = parseScriptletLine(line)
    if (scriptlet !== undefined) {
      for (const domain of scriptlet.domains) {
        scriptletsForDomains[domain] ||= []
        scriptletsForDomains[domain].push(scriptlet.command)
      }
    }
  }
  return scriptletsForDomains
}

const isCookieScriptlet = (scriptlet: ScriptletCommand): boolean => {
  return scriptlet[0] === 'set-cookie' || scriptlet[0] === 'remove-cookie'
}

const generateScriptletRules = (scriptletsForDomains: Record<string, ScriptletCommand[]>): chrome.declarativeNetRequest.Rule[] => {
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let id = 1
  for (const [domain, scriptlets] of entries(scriptletsForDomains)) {
    const noncookieScriptlets = scriptlets.filter(scriptlet => !isCookieScriptlet(scriptlet))
    if (noncookieScriptlets.length > 0) {
      const cookieValue = jsonToBase64(noncookieScriptlets)
      rules.push(appendCookieRule(domain, SCRIPTLET_COOKIE_KEY, cookieValue, id))
      ++id
    }
    const cookieScriptlets = scriptlets.filter(isCookieScriptlet)
    if (cookieScriptlets.length > 0) {
      for (const cookieScriptlet of cookieScriptlets) {
        const [scriptletName, ...args] = cookieScriptlet
        if (scriptletName === 'set-cookie') {
          const [cookieKey, cookieValue] = args
          rules.push(appendCookieRule(domain, cookieKey, cookieValue, id))
        } else if (scriptletName === 'remove-cookie') {
          const [cookieKey] = args
          rules.push(removeCookieRule(domain, cookieKey, id))
        }
        ++id
      }
    }
  }
  return rules
}

const generateScriptletRulesFile = async (scriptletsForDomains: Record<string, ScriptletCommand[]>): Promise<void> => {
  const rules = generateScriptletRules(scriptletsForDomains)
  const scriptletBody = JSON.stringify(rules, null, 2)
  await writeFile(FILTER_LIST_DIR, SCRIPTLET_RULES_FILE, scriptletBody)
}

export const parseAndGenerateScriptlets = async (lines: string[]): Promise<void> => {
  const scriptletsForDomains = collectScriptletsForDomains(lines)
  await generateScriptletRulesFile(scriptletsForDomains)
}
