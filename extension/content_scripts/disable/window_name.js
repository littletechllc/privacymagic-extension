console.log('disable/window_name.js loaded', Date.now());
window.__patch_decisions__ ||= {};
window.__patch_decisions__.window_name = false;
if (window.__inject_if_ready__) {
  window.__inject_if_ready__();
}