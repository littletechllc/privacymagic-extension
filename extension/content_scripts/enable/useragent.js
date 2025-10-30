console.log('enable/useragent.js loaded', Date.now());
window.__patch_decisions__ ||= {};
window.__patch_decisions__.useragent = true;
if (window.__inject_if_ready__) {
  window.__inject_if_ready__();
}