try {
  window.top.location.href;
} catch (_) {
  window.redefineScreen();
  delete window.redefineScreen;
}
