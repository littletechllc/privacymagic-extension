export const showBlockedRequests = (): void => {
  const blockedRequestsPerTab = new Map<number, number>();
  const currentDocumentPerTab = new Map<number, string>();

  const resetCountsForTab = (tabId: number, documentId: string) => {
    blockedRequestsPerTab.set(tabId, 0);
    currentDocumentPerTab.set(tabId, documentId);
    void chrome.action.setBadgeText({ text: "", tabId });
  };

  const incrementCountForTab = (tabId: number, documentId: string) => {
    if (currentDocumentPerTab.get(tabId) !== documentId) return;
    const existingCount = blockedRequestsPerTab.get(tabId) || 0;
    const newCount = existingCount + 1;
    blockedRequestsPerTab.set(tabId, newCount);
    void chrome.action.setBadgeText({ text: String(newCount), tabId });
  };

  chrome.webRequest.onErrorOccurred.addListener((details) => {
    if (details.error === "net::ERR_BLOCKED_BY_CLIENT" && details.documentId) {
      incrementCountForTab(details.tabId, details.documentId);
    }
  }, { urls: ["<all_urls>"] });

  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) {
      resetCountsForTab(details.tabId, details.documentId);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    blockedRequestsPerTab.delete(tabId);
    currentDocumentPerTab.delete(tabId);
  });

  void chrome.action.setBadgeBackgroundColor({ color: "#0000AF" });
  void chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
};