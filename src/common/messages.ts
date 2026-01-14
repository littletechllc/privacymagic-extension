import { SettingsId } from './settings-ids'

// Message types that can be sent to the background script
export type Message =
  | { type: 'updateSetting', domain: string, settingId: SettingsId, value: boolean }
  | { type: 'addHttpWarningNetworkRuleException', url: string, value: boolean }
  | { type: 'getRemoteStyleSheetContent', href: string }
  | { type: 'getDomainForCurrentTab' }

type ErrorResponse = { success: false, error: string }

// Response types for each message type
export type MessageResponse =
  | { success: true }
  | { success: true, domain: string }
  | { success: true, content: string }
  | ErrorResponse

// Helper type for the sendResponse function
export type ResponseSendFunction = (response: MessageResponse) => void

// Typed functions for each message type with matching response types
export const updateSettingMessageRemote = async (
  domain: string,
  settingId: SettingsId,
  value: boolean
): Promise<{ success: true } | { success: false, error: string }> => {
  const message: Message = { type: 'updateSetting', domain, settingId, value }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as { success: true } | ErrorResponse
  if (response.success) {
    return { success: true }
  } else {
    throw new Error(response.error)
  }
}

export const addHttpWarningNetworkRuleExceptionMessageRemote = async (
  url: string,
  value: boolean
): Promise<{ success: true } | { success: false, error: string }> => {
  const message: Message = { type: 'addHttpWarningNetworkRuleException', url, value }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as { success: true } | ErrorResponse
  if (response.success) {
    return { success: true }
  } else {
    throw new Error(response.error)
  }
}

export const getRemoteStyleSheetContentMessageRemote = async (
  href: string
): Promise<string> => {
  const message: Message = { type: 'getRemoteStyleSheetContent', href }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as { success: true, content: string } | ErrorResponse
  if (response.success) {
    return response.content
  } else {
    throw new Error(response.error)
  }
}

export const getDomainForCurrentTabMessageRemote = async (): Promise<string> => {
  const message: Message = { type: 'getDomainForCurrentTab' }
  const response = (await chrome.runtime.sendMessage(message)) as unknown as { success: true, domain: string } | ErrorResponse
  if (response.success) {
    return response.domain
  } else {
    throw new Error(response.error)
  }
}

