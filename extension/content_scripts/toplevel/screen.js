try {
  window.top.location.href;
  window.redefineScreen();
  delete window.redefineScreen;
} catch (_) { /* ignore */ }
