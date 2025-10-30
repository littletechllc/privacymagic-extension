console.log('enable/hardware.js loaded', Date.now());
window.__patch_decisions__ ||= {};
window.__patch_decisions__.hardware = true;
if (window.__inject_if_ready__) {
  window.__inject_if_ready__();
}