try {
  window.top.location.href;
} catch (_) {
  window.redefineGlobalPrivacyControl();
  delete window.redefineGlobalPrivacyControl;
}
