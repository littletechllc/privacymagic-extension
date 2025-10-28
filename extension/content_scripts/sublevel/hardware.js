try {
  window.top.location.href;
} catch (_) {
  window.redefineHardware();
  delete window.redefineHardware;
}
