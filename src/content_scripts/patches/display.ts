import { spoofMediaQuery } from '../helpers.js';

const display = () => {
  const undoSpoof = spoofMediaQuery('prefers-reduced-motion', 'no-preference');
  return undoSpoof;
};

export default display;
