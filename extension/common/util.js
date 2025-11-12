import psl from '../thirdparty/psl.mjs';

export const registrableDomainFromUrl = (url) =>
  psl.get(new URL(url).hostname);

export const logError = (error, message, details) => {
  console.error('Error:', `'${message}'`, `'${error.name}'`, `'${error.message}'`, details, error.stack);
};
