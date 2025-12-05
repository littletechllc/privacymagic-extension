/* global self */

const sharedStorage = () => {
  if (!self.SharedStorage) {
    return () => {};
  }
  const originalSharedStorage = self.SharedStorage;
  delete self.SharedStorage;
  return () => {
    self.SharedStorage = originalSharedStorage;
  };
};

export default sharedStorage;
