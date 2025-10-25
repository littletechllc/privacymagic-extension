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

  const toggleOuter = document.createElement('div');
  toggleOuter.className = 'toggle-outer';

  const switchLabel = document.createElement('label');
  switchLabel.htmlFor = id;
  switchLabel.className = 'box';

  const switchDiv = document.createElement('div');
  switchDiv.className = 'switch';
  switchLabel.appendChild(switchDiv);

  const textLabel = document.createElement('label');
  textLabel.htmlFor = id;
  textLabel.className = 'text';
  textLabel.textContent = getLocalizedText(id);

  toggleOuter.appendChild(input);
  toggleOuter.appendChild(switchLabel);
  toggleOuter.appendChild(textLabel);

  return toggleOuter;
}
