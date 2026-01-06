const sharedStorage = (): (() => void) => {
  if (self.SharedStorage == null) {
    return () => {}
  }
  const originalSharedStorage = self.SharedStorage
  delete self.SharedStorage
  return () => {
    self.SharedStorage = originalSharedStorage
  }
}

export default sharedStorage
