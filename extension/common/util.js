import psl from '../thirdparty/psl.mjs';

export const getRegistrableDomainFromUrl = (url) =>
  psl.get(new URL(url).hostname);
