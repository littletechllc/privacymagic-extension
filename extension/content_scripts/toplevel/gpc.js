try {
  window.top.location.href;
  window.redefineGlobalPrivacyControl();
  delete window.redefineGlobalPrivacyControl;
} catch (_) { /* ignore */ }
