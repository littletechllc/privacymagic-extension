import { getLocalizedText } from './i18n';

export const createToggle = async (id: string, locked = false) => {
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  input.disabled = locked;

  const toggleOuter = document.createElement('div');
  toggleOuter.className = 'toggle-outer';

  const switchLabel = document.createElement('label');
  switchLabel.htmlFor = id;
  switchLabel.className = 'box' + (locked ? ' locked' : '');

  const switchDiv = document.createElement('div');
  switchDiv.className = 'switch';
  switchLabel.appendChild(switchDiv);

  const textLabel = document.createElement('label');
  textLabel.htmlFor = id;
  textLabel.className = 'text' + (locked ? ' locked' : '');
  textLabel.textContent = getLocalizedText(id);

  toggleOuter.appendChild(input);
  toggleOuter.appendChild(switchLabel);
  toggleOuter.appendChild(textLabel);
  if (locked) {
    textLabel.textContent = '🔒 ' + textLabel.textContent;
    toggleOuter.classList.add('locked');
  }

  return toggleOuter;
};
