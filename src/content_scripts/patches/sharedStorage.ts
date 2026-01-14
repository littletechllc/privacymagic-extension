const sharedStorage = (): void => {
  if (self.SharedStorage == null) {
    return
  }
  delete self.SharedStorage
}

export default sharedStorage
