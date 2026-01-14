const sharedStorage = (): void => {
  if (self.SharedStorage === null || self.SharedStorage === undefined) {
    return
  }
  delete self.SharedStorage
}

export default sharedStorage
