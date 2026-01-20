const settingToIdMap = new Map<string, number>();

let highestId = 0;

export const idForSetting = (setting: string): number => {
  if (!settingToIdMap.has(setting)) {
    ++highestId
    settingToIdMap.set(setting, highestId)
  }
  return settingToIdMap.get(setting)!
}