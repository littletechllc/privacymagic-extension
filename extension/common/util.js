import psl from '../thirdparty/psl.mjs';

export const registrableDomainFromUrl = (url) =>
  psl.get(new URL(url).hostname);
