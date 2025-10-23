import { getLocalizedText } from './i18n.js';

export const createCheckboxBoundToStorage = async (storage, keyPath, defaultValue) => {
  const id = keyPath[keyPath.length - 1];
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  const currentValue = await storage.get(keyPath);
  input.checked = currentValue !== undefined ? currentValue : defaultValue;
  input.addEventListener('change', (event) => {
    const value = event.target.checked;
    if (value === defaultValue) {
      storage.remove(keyPath);
    } else {
      storage.set(keyPath, value);
    }
  });
  storage.listenForChanges(keyPath, (value) => {
    input.checked = value !== undefined ? value : defaultValue;
  });
  const label = document.createElement('label');
  label.appendChild(input);
  label.appendChild(document.createTextNode(getLocalizedText(id)));
  return label;
}
