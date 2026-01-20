const settingToIdMap = new Map<string, number>();

let highestId = 0;

export const idForRuleName = (ruleName: string): number => {
  if (!settingToIdMap.has(ruleName)) {
    ++highestId
    settingToIdMap.set(ruleName, highestId)
  }
  return settingToIdMap.get(ruleName)!
}