// Mocks for Chrome WebExtensions APIs
// Can be imported in any order since ALL_RESOURCE_TYPES now uses lazy evaluation
// This setup is idempotent - safe to import multiple times
import { jest } from '@jest/globals'

// Only set up if not already set up (idempotent)
if (global.chrome?.declarativeNetRequest?.ResourceType === undefined) {
  // Create a mock ResourceType enum
  const mockResourceType = {
    MAIN_FRAME: 'main_frame',
    SUB_FRAME: 'sub_frame',
    STYLESHEET: 'stylesheet',
    SCRIPT: 'script',
    IMAGE: 'image',
    FONT: 'font',
    OBJECT: 'object',
    XMLHTTPREQUEST: 'xmlhttprequest',
    PING: 'ping',
    CSP_REPORT: 'csp_report',
    MEDIA: 'media',
    WEBSOCKET: 'websocket',
    WEBTRANSPORT: 'webtransport',
    WEBBUNDLE: 'webbundle',
    OTHER: 'other'
  } as const

  // Setup chrome mock
  if (global.chrome === undefined) {
    global.chrome = {} as typeof chrome
  }

  // Create mock functions with proper types
  const mockGetSessionRules = jest.fn<(filter?: chrome.declarativeNetRequest.GetRulesFilter) => Promise<chrome.declarativeNetRequest.Rule[]>>()
  const mockUpdateSessionRules = jest.fn<(options: chrome.declarativeNetRequest.UpdateRuleOptions) => Promise<void>>()

  global.chrome.declarativeNetRequest = {
    ResourceType: mockResourceType as unknown as typeof chrome.declarativeNetRequest.ResourceType,
    getSessionRules: mockGetSessionRules as typeof chrome.declarativeNetRequest.getSessionRules,
    updateSessionRules: mockUpdateSessionRules as typeof chrome.declarativeNetRequest.updateSessionRules
  } as unknown as typeof chrome.declarativeNetRequest
}
