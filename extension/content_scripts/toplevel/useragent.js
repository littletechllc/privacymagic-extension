try {
  window.top.location.href;
  window.redefineUserAgent();
  delete window.redefineUserAgent;
} catch (_) { /* ignore */ }
