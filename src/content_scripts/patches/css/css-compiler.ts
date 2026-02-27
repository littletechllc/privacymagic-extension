import { createSafeMethod } from '@src/content_scripts/helpers/monkey-patch'
import { stringReplaceSafe } from '@src/content_scripts/helpers/safe'
import { backgroundFetch } from '@src/content_scripts/helpers/background-fetch-main'
import { resolveAbsoluteUrl } from '@src/content_scripts/helpers/helpers'

const regexExecSafe = createSafeMethod(RegExp, 'exec')
const regexTestSafe = createSafeMethod(RegExp, 'test')

const extractImportUrls = (cssText: string, baseURL: string): { urls: string[], cssTextWithoutImports: string } => {
  // TODO: Handle layer(...), supports(...) and list-of-media-queries.
  const urls: string[] = []
  const regex = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*;/gi
  let match: RegExpExecArray | null
  match = regexExecSafe(regex, cssText)
  while (match !== null) {
    urls.push(resolveAbsoluteUrl(match[1], baseURL))
    match = regexExecSafe(regex, cssText)
  }
  const cssTextWithoutImports = cssText.replace(regex, '')
  return { urls, cssTextWithoutImports }
}

/**
 * Converts relative url() URLs to absolute ones.
 * @param {string} cssText - The raw CSS content.
 * @param {string} baseURL - The absolute URL of the original CSS file.
 */
const convertToAbsoluteUrls = (cssText: string, baseURL: string): string => {
  // Regex captures the path inside url(), handling optional quotes and whitespace
  const urlRegex = /url\(\s*['"]?([^'")]*?)['"]?\s*\)/gi;
  return stringReplaceSafe(cssText, urlRegex, (match: string, path: string) => {
    // 1. Skip empty paths, absolute URLs, or data URIs
    if (!path || regexTestSafe(/^https?:\/\/|^data:|^blob:/i, path)) {
      return match;
    }
    // 2. Resolve the path relative to the baseURL
    try {
      const absoluteUrl = resolveAbsoluteUrl(path, baseURL);
      return `url("${absoluteUrl}")`;
    } catch {
      // If resolution fails (invalid path), return the original match
      return match;
    }
  });
}

const fetchSafe = fetch

let pendingRemoteStyleSheets = 0

const getRemoteStyleSheetContent = async (href: string): Promise<string> => {
  pendingRemoteStyleSheets++
  let content = ''
  try {
    const response = await fetchSafe(href)
    if (response.ok) {
      console.log('direct fetch successful for href:', href)
      content = await response.text()
    } else {
      throw new Error(`direct fetch failed for href: ${href}, status: ${response.status}`)
    }
  } catch (error) {
    console.error('error getting remote style sheet content for href:', href, 'error:', error)
    try {
      content = await backgroundFetch(href)
      console.log('background fetch successful for href:', href, content)
    } catch (error) {
      console.error('error dispatching background fetch:', error)
    }
  }
  pendingRemoteStyleSheets--
  return content
}

export const compileRemoteCss = async (href: string, baseURL: string): Promise<string> => {
  const absoluteHref = resolveAbsoluteUrl(href, baseURL)
  const content = await getRemoteStyleSheetContent(absoluteHref)
  return compileCss(content, absoluteHref)
}

export const compileCss = async (cssText: string, baseURL: string): Promise<string> => {
  const contentWithAbsoluteUrls = convertToAbsoluteUrls(cssText, baseURL)
  const { urls: importUrls, cssTextWithoutImports } = extractImportUrls(contentWithAbsoluteUrls, baseURL)
  const importContents = await Promise.all(importUrls.map(
    async (href: string) => compileRemoteCss(href, baseURL)))
  return importContents.join('\n') + '\n' + cssTextWithoutImports
}

export const getPendingRemoteStyleSheets = (): number => {
  return pendingRemoteStyleSheets
}