import { SCRIPTLET_RULES_FILE, FILTER_LIST_DIR } from '@src/common/filter-list-paths'
import { entries } from '../util'
import { writeFile } from './util'
import { SCRIPTLET_COOKIE_KEY } from '@src/common/setting-ids'
import { DNR_RULE_PRIORITIES } from '@src/background/dnr/rule-priorities'
import { ScriptletName, ScriptletCommand } from '@src/common/scriptlet-names'

const toBase64 = (s: string): string => {
  return Buffer.from(s, 'utf-8').toString('base64')
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
  const domains = matches[1].split(',').filter(d => !d.endsWith('*'))
  const scriptletArguments = matches[2].split(',').map(s => s.trim())
  const scriptletCommand = normalizeScriptletCommand(scriptletArguments)
  if (scriptletCommand === undefined) {
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

const generateScriptletRules = (scriptletsForDomains: Record<string, ScriptletCommand[]>): chrome.declarativeNetRequest.Rule[] => {
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let id = 0
  for (const [domain, scriptlets] of entries(scriptletsForDomains)) {
    ++id
    rules.push({
      id,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{
          operation: 'append',
          header: 'Set-Cookie',
          value: `${SCRIPTLET_COOKIE_KEY}=${toBase64(JSON.stringify(scriptlets))}; Secure; SameSite=None; Path=/; Partitioned`
        }]
      },
      priority: DNR_RULE_PRIORITIES.STATIC_RULES,
      condition: {
        urlFilter: `||${domain}`,
        resourceTypes: ['main_frame', 'sub_frame']
      }
    })
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
