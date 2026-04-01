/**
 * @types/chrome defines CloseOptions but omits close() (Chrome 141+).
 * Augment global `chrome.sidePanel` like other DOM/API extensions in this folder.
 */
export {}

declare global {
  namespace chrome {
    namespace sidePanel {
      /** @since Chrome 141 */
      function close (options: chrome.sidePanel.CloseOptions): Promise<void>
    }
  }
}
