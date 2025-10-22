export const createCheckboxBoundToStorage = async (storage, keyPath, inverted) => {
  const id = keyPath[keyPath.length - 1];
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  const currentValue = await storage.get(keyPath);
  input.checked = inverted ? !currentValue : currentValue;
  input.addEventListener('change', (event) => {
    storage.set(keyPath, inverted ? !event.target.checked : event.target.checked);
  });
  storage.listenForChanges(keyPath, (value) => {
    input.checked = inverted ? !value : value;
  });
  const label = document.createElement('label');
  label.textContent = chrome.i18n.getMessage(id);
  label.appendChild(input);
  return label;
}
