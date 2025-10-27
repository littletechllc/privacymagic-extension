try {
  window.top.location.href;
  window.redefineWindowName();
  delete window.redefineWindowName;
} catch (_) { /* ignore */ }