const DATA_SECRET_ATTRIBUTE = 'data-privacy-magic-secret';

export const sharedSecret = (() => {
  if (self.__existing_secret__) {
    const existingSecret = self.__existing_secret__;
    delete self.__existing_secret__;
    return existingSecret;
  }
  const documentElement = document.documentElement;
  const existingSecret = documentElement.getAttribute(DATA_SECRET_ATTRIBUTE);
  if (existingSecret !== null) {
    documentElement.removeAttribute(DATA_SECRET_ATTRIBUTE);
    return existingSecret;
  } else {
    let newSecret;
    try {
      newSecret = crypto.randomUUID();
    } catch (error) {
      newSecret = Math.random().toString(16).substring(2);
    }
    documentElement.setAttribute(DATA_SECRET_ATTRIBUTE, newSecret);
    return newSecret;
  }
})();
