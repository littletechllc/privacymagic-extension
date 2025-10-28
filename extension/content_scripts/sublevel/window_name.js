try {
  window.top.location.href;
} catch (_) {
  window.redefineWindowName();
  delete window.redefineWindowName;
}
