console.log('disable/screen.js loaded', Date.now());
window.__patch_decisions__ ||= {};
window.__patch_decisions__.screen = false;
if (window.__inject_if_ready__) {
  window.__inject_if_ready__();
}
