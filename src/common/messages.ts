import { SettingId } from './setting-ids'

// Message types that can be sent to the background script
export type Message =
  | { type: 'updateSetting', domain: string, settingId: SettingId, value: boolean }
  | { type: 'addHttpWarningNetworkRuleException', url: string, value: boolean }
  | { type: 'getRemoteStyleSheetContent', url: string }
  | { type: 'getDomainForCurrentTab' }
  | { type: 'reloadTab', tabId: number }

export type SuccessResponse = { success: true }
export type DomainResponse = { success: true, domain: string }
export type ContentResponse = { success: true, content: string }
export type ErrorResponse = { success: false, error: string }

// Response types for each message type
export type MessageResponse =
  | SuccessResponse
  | DomainResponse
  | ContentResponse
  | ErrorResponse

// Helper type for the sendResponse function
export type ResponseSendFunction = (response: MessageResponse) => void

// Typed functions for each message type with matching response types
export const updateSettingRemote = async (
  domain: string,
  settingId: SettingId,
  value: boolean
  ): Promise<void> => {
  const message: Message = { type: 'updateSetting', domain, settingId, value }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as SuccessResponse | ErrorResponse
  if (!response.success) {
    throw new Error(response.error)
  }
}

export const addHttpWarningNetworkRuleExceptionRemote = async (
  url: string,
  value: boolean
): Promise<void> => {
  const message: Message = { type: 'addHttpWarningNetworkRuleException', url, value }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as SuccessResponse | ErrorResponse
  if (!response.success) {
    throw new Error(response.error)
  }
}

export const getRemoteStyleSheetContentRemote = async (
  url: string
): Promise<string> => {
  const message: Message = { type: 'getRemoteStyleSheetContent', url }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as ContentResponse | ErrorResponse
  if (!response.success) {
    throw new Error(response.error)
  }
  return response.content
}

export const getDomainForCurrentTabMessageRemote = async (): Promise<string> => {
  const message: Message = { type: 'getDomainForCurrentTab' }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as DomainResponse | ErrorResponse
  if (!response.success) {
    throw new Error(response.error)
  }
  return response.domain
}

export const reloadTabRemote = async (tabId: number): Promise<void> => {
  console.log('sending reloadTab message to background script', tabId)
  const message: Message = { type: 'reloadTab', tabId }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as SuccessResponse | ErrorResponse
  if (!response.success) {
    throw new Error(response.error)
  }
}