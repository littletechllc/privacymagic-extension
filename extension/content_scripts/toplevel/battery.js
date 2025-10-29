try {
  window.top.location.href;
  window.redefineBattery();
  delete window.redefineBattery;
} catch (_) { /* ignore */ }
