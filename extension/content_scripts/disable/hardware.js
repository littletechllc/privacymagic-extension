console.log('disable/hardware.js loaded', Date.now());
window.__patch_decisions__ ||= {};
window.__patch_decisions__.hardware = false;
if (window.__inject_if_ready__) {
  window.__inject_if_ready__();
}