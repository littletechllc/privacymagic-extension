console.log('enable/gpc.js loaded', Date.now());
window.__patch_decisions__ ||= {};
window.__patch_decisions__.gpc = true;
if (window.__inject_if_ready__) {
  window.__inject_if_ready__();
}