try {
  window.top.location.href;
} catch (_) {
  window.redefineBattery();
  delete window.redefineBattery;
}
