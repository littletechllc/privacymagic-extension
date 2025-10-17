import fs from 'node:fs/promises'
import path from 'node:path'

const BLOCKLISTS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt'
]

const ALLOWED_RESOURCE_TYPES = [
  "subdocument",
  "document",
  "stylesheet",
  "image",
  "script",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "media",
  "popup",
  "generichide",
  "webrtc",
  "websocket",
  "xhr",
  "method",
  "other",
]

const RESOURCE_TYPE_EQUIVALENCES = {
  "subdocument": "sub_frame",
  "document": "main_frame",
  "xhr": "xmlhttprequest",
}

// Fetch the lines from the given URL
const getLines = async (url) => {
  const response = await fetch(url)
  const content = await response.text()
  return content.split('\n')
}

// Fetch the lines from all the given URLs
const getAllLines = async (urls) => {
  const results = await Promise.all(BLOCKLISTS.map(getLines))
  return [].concat.apply([], results)
}

// Remove comments from the given lines
const removeComments = (lines) =>
  lines.filter(line => {
    const trimmed = line.trim()
    return !trimmed.startsWith('!')
  }).slice(1)

// Convert the given resource type from the adblock list to
// its Chrome extension equivalent
const toEquivalentResourceType = (raw) => {
  if (!ALLOWED_RESOURCE_TYPES.includes(raw)) {
    throw new Error(`Unknown resource type '${raw}'`)
  }
  return RESOURCE_TYPE_EQUIVALENCES[raw] || raw
}

// Remove empty arrays from the given object
const removeEmptyArrays = (obj) => {
  const result = {}
  for (const [k,v] of Object.entries(obj)) {
    if (v && v.length > 0) {
      result[k] = v
    }
  }
  return result
}

// Parse the given type options string into an object with the following keys:
// - domainType: the type of domain (firstParty or thirdParty)
// - resourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, popup, generichide, webrtc, websocket, other)
// - excludedResourceTypes: one or more of the resource types (sub_frame, stylesheet, image, script, object, xmlhttprequest, ping, media, popup, generichide, webrtc, websocket, other)
// - excludedInitiatorDomains: one or more domain names or wildcard domain names
// - initiatorDomains: one or more domain names or wildcard domain names
// - requestMethods: one or more request methods ("connect", "delete", "get", "head", "options", "patch", "post", "put", "other")
// - excludedRequestMethods: one or more request methods ("connect", "delete", "get", "head", "options", "patch", "post", "put", "other")
// - cspLine: the CSP line
// - redirect
const typeOptionsStringToLists = (typeOptionsString) => {
  const resourceTypes = [], excludedResourceTypes = [],
        excludedInitiatorDomains = [], initiatorDomains = [],
        requestMethods = [], excludedRequestMethods = []
  let domainType = ''
  let cspLine = ''
  let redirect = ''
  let badFilter = false
  const items = typeOptionsString.split(',')
  for (const item of items) {
    if (item.startsWith("domain=")) {
      const domains = item.split('=')[1].split("|")
      for (const domain of domains) {
        if (domain.startsWith("~")) {
          excludedInitiatorDomains.push(domain.substring(1))
        } else {
          initiatorDomains.push(domain)
        }
      }
    } else if (item.startsWith("method=")) {
      const methods = item.split('=')[1].split("|")
      for (const method of methods) {
        if (method.startsWith("~")) {
          excludedRequestMethods.push(method.substring(1))
        } else {
          requestMethods.push(method)
        }
      }
    } else if (item.startsWith("csp")) {
      if (item.startsWith("csp=")) {
        cspLine = item.split('=')[1]
      } else {
        cspLine = ''
      }
    } else if (item.startsWith("redirect=")) {
      redirect = item.split('=')[1]
    } else if (item.startsWith("~")) {
      if (item === '~third-party') {
        domainType = 'firstParty'
      } else {
        excludedResourceTypes.push(toEquivalentResourceType(item.substring(1)))
      }
    } else if (item === 'third-party') {
      domainType = 'thirdParty'
    } else if (item === 'badfilter') {
      badFilter = true
    } else {
      resourceTypes.push(toEquivalentResourceType(item))
    }
  }
  const output = {
    domainType,
    resourceTypes, excludedResourceTypes,
    initiatorDomains, excludedInitiatorDomains,
    requestMethods, excludedRequestMethods,
    cspLine, redirect, badFilter, 
  }
  return removeEmptyArrays(output)
}

// Parse the given line into a URL filter and a list of type options
const lineToUrlFilter = (line) => {
  if (line.includes('$')) {
    const [urlFilter, typeOptionsString] = line.split('$')
    return removeEmptyArrays(Object.assign(
      { urlFilter },
      typeOptionsStringToLists(typeOptionsString)))

  }
  return { urlFilter: line }
}

const parseBlockingFilter = (line) => {
  const isRegexFilter = line.startsWith('/') && line.endsWith('/')
  const type = line.startsWith('@@') ? 'allow' : 'block'
  const cleanLine = line.startsWith('@@') ? line.substring(2) : line
  const condition = isRegexFilter ?
                      { regexFilter: cleanLine } : lineToUrlFilter(cleanLine)
  return { priority: 1, action: { type }, condition }
}

const contentFilterSeparators = ['#?#', '#@#', '#S#', '##']

const parseContentFilter = (line, separator) => {
  const [domainsString, body] = line.split(separator)
  const domains = domainsString.split(',').filter(d => !d.endsWith("*"))
  return { domains, body, separator }
}

const parseLine = (line) => {
  try {
    for (const separator of contentFilterSeparators) {
      if (line.includes(separator)) {
        return {
          type: "contentFilter",
          parsed: parseContentFilter(line, separator),
          line
        }
      }
    }
    return {
      type: "blockingFilter",
      parsed: parseBlockingFilter(line),
      line
    }
  } catch (e) {
    e.message = `line '${line}':\n` + e.message
    throw e
  }
}

export const process = (lines) => {
  const cleanLines = removeComments(lines)
  return cleanLines.filter(line => line.length > 0).map(parseLine)
}

const generateBlockingRulesFile = (items) => {
  const lines = [];
  let id = 0;
  for (const item of items) {
    if (item.type === 'blockingFilter') {
      ++id;
      lines.push(JSON.stringify(Object.assign({id}, item.parsed)))
    }
  }
  return "[\n" + lines.join(",\n") + "]"
}

const generateContentRules = (items) => {
  const selectorsForDomain = {}
  let id = 0;
  for (const item of items) {
    const parsed = item.parsed
    if (item.type === 'contentFilter' && parsed.separator === "##") {
      if (!parsed.body.includes('has-text') && !parsed.body.startsWith('+js(')) {
        for (const domain of parsed.domains) {
          selectorsForDomain[domain] ||= []
          selectorsForDomain[domain].push(parsed.body)
        }
      }
    }
  }
  return selectorsForDomain
}

const SELECTOR_CHUNK_SIZE = 1024

const generateContentRulesFiles = async (dir, selectorsForDomains) => {
  const files = []
  for (const [domain, selectors] of Object.entries(selectorsForDomains)) {
    const selectorsSorted = selectors.sort()
    const nChunks = Math.ceil(selectorsSorted.length / SELECTOR_CHUNK_SIZE)
    for (let i = 0; i < nChunks; ++i) {
      const file = domain === '' ?
        `__default_${i}.css` :
        `${domain}_${i === 0 ? '' : i}.css`
      files.push(file)
      const selected = selectorsSorted.slice(SELECTOR_CHUNK_SIZE * i, SELECTOR_CHUNK_SIZE * (i+1))
      await fs.writeFile(path.join(dir, file),
        `html {\n${selected.join(",\n")} { display: none !important; }\n}`)
    }
  }
  return files
}

const createContentBlockingDefinitions = (cssFiles) => {
  const definitions = [];
  for (const cssFile of cssFiles.sort()) {
    const isDefault = cssFile.startsWith('__default_')
    const domain = isDefault ? 'default' : cssFile.replace(/_[0-9]*?\.css$/,'')
    const id = cssFile.replace(/.css$/,'').replaceAll('_','')
    const matches = isDefault ?
      ['*://*/*'] :
      [`*://${domain}/*`, `*://*.${domain}/*`]
    definitions.push({
      id,
      css: [`content_scripts/adblock_css/${cssFile}`],
      matches,
      allFrames: true,
      world: "MAIN",
      runAt: "document_start",
      matchOriginAsFallback: true,
    })
  }
  return definitions
}

const addContentBlockingRulesToManifest = (manifest, contentBlockingRules) => {
  manifest.content_scripts.concat(contentBlockingRules)
  return manifest
}

const readManifestFile = async () => {
  const result = await fs.readFile(path.join(__dirname, '../inputs/', 'manifest.json'))
  return JSON.parse(result)
}

const ext = (file) => path.join(__dirname, '../extension/', file)

const writeManifestFile = async (manifest) => {
  fs.writeFile(
    ext('manifest.json'),
    JSON.stringify(manifest, undefined, "  "))
}

const isGoodLine = x => {
  const result = !x.startsWith('$websocket,domain=') &&
  !x.startsWith('$popup') &&
  !x.startsWith('$popup,third-party,domain=') &&
  !x.includes('Anâ€Œonâ€Œymous') &&
  !x.includes('συνεργασία') &&
  !x.includes('ได้รับการโปรโมท') &&
  !x.includes('Спонсорирани') &&
  !x.includes('परचरत') &&
  !x.includes('$/$') &&
  !x.includes('$)/$') &&
  !x.includes('abp-resource:') &&
  !x.includes(',important') &&
  !x.includes(' cookieman')
  if (!result) {
    console.log(x)
  }
  return result
}

export const processAndWrite = async () => {
  const lines = await getAllLines();
  const linesFiltered = lines.filter(isGoodLine)
  const results = process(linesFiltered)
  const results2 = results.filter(x => !x.parsed?.condition?.resourceTypes?.includes('popup'))
  const blockingRulesFileContent = generateBlockingRulesFile(results2)
  await fs.mkdir(ext('rules'), {recursive: true})
  await fs.writeFile(ext('rules/easylist.json'),
                     blockingRulesFileContent)
  const contentRules = generateContentRules(results2)
  const adblock_css_dir = ext('content_scripts/adblock_css')
  await fs.mkdir(adblock_css_dir, {recursive: true})
  const cssFiles = await generateContentRulesFiles(adblock_css_dir, contentRules)
  //const manifest = await readManifestFile()
  //console.log(cssFiles)
  //const manifest_final = addContentBlockingRulesToManifest(manifest, cssFiles)
  //await writeManifestFile(manifest_final)
  //console.log(contentRules)
  const contentBlockingDefintions = createContentBlockingDefinitions(cssFiles)
  await fs.writeFile(
    ext('background/content-blocking-definitions.js'),
    'export const contentBlockingDefinitions = ' + JSON.stringify(contentBlockingDefintions, undefined, "  ")
  )
}
