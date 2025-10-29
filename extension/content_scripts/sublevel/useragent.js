try {
  window.top.location.href;
} catch (_) {
  window.redefineUserAgent();
  delete window.redefineUserAgent;
}
