// Mocks for Chrome WebExtensions APIs
// Can be imported in any order since ALL_RESOURCE_TYPES now uses lazy evaluation
// This setup is idempotent - safe to import multiple times
import { jest } from '@jest/globals'

// Create mock functions with proper types
const mockGetDynamicRules = jest.fn<(filter?: chrome.declarativeNetRequest.GetRulesFilter) => Promise<chrome.declarativeNetRequest.Rule[]>>()
const mockUpdateDynamicRules = jest.fn<(options: chrome.declarativeNetRequest.UpdateRuleOptions) => Promise<void>>()
const mockStorageGet = jest.fn<(keys?: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>>()
const mockStorageSet = jest.fn<(items: Record<string, unknown>) => Promise<void>>()
const mockStorageRemove = jest.fn<(keys: string | string[]) => Promise<void>>()
const mockStorageClear = jest.fn<() => Promise<void>>()

// Export typed mocks for use in tests
export const getDynamicRulesMock = mockGetDynamicRules
export const updateDynamicRulesMock = mockUpdateDynamicRules
export const storageLocalGetMock = mockStorageGet
export const storageLocalSetMock = mockStorageSet
export const storageLocalRemoveMock = mockStorageRemove
export const storageLocalClearMock = mockStorageClear

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

  global.chrome.declarativeNetRequest = {
    ResourceType: mockResourceType as unknown as typeof chrome.declarativeNetRequest.ResourceType,
    getDynamicRules: mockGetDynamicRules as typeof chrome.declarativeNetRequest.getDynamicRules,
    updateDynamicRules: mockUpdateDynamicRules as typeof chrome.declarativeNetRequest.updateDynamicRules
  } as unknown as typeof chrome.declarativeNetRequest

  // Mock chrome.storage if not already set up
  if (global.chrome.storage === undefined) {
    const mockStorageLocal = {
      get: mockStorageGet as unknown as typeof chrome.storage.local.get,
      set: mockStorageSet as unknown as typeof chrome.storage.local.set,
      remove: mockStorageRemove as unknown as typeof chrome.storage.local.remove,
      clear: mockStorageClear as unknown as typeof chrome.storage.local.clear,
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn()
      }
    }
    global.chrome.storage = {
      local: mockStorageLocal
    } as unknown as typeof chrome.storage
  }
}
