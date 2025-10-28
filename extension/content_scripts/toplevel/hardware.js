try {
  window.top.location.href;
  window.redefineHardware();
  delete window.redefineHardware;
} catch (_) { /* ignore */ }
