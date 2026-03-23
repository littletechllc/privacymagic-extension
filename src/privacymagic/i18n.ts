type Applicator = (el: HTMLElement, msg: string) => void;

const ATTR_MAP: Record<string, Applicator> = {
  'data-i18n':             (el, msg) => { el.textContent = msg; },
  'data-i18n-html':        (el, msg) => { el.innerHTML = msg; },
  'data-i18n-title':       (el, msg) => { el.title = msg; },
  'data-i18n-alt':         (el, msg) => { el.setAttribute('alt', msg); },
  'data-i18n-placeholder': (el, msg) => { (el as HTMLInputElement).placeholder = msg; },
  'data-i18n-aria-label':  (el, msg) => { el.setAttribute('aria-label', msg); },
};

function applyI18n(root: Document | HTMLElement = document): void {
  for (const [attr, apply] of Object.entries(ATTR_MAP)) {
    root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach(el => {
      const key = el.getAttribute(attr);
      if (!key) return;

      const rawArgs = el.dataset.i18nArgs;
      const args: string[] = rawArgs
        ? rawArgs.split(',').map(k => chrome.i18n.getMessage(k.trim()) || k.trim())
        : [];

      const msg = chrome.i18n.getMessage(key, args);

      if (msg) {
        apply(el, msg);
      } else {
        console.warn(`[i18n] Missing message key: "${key}"`);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applyI18n());
} else {
  applyI18n();
}