type OperatingSystem = 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'Unknown'

export const getOperatingSystem = (): OperatingSystem => {
  const platform = (navigator.userAgentData?.platform ?? 'unknown').toLowerCase()
  if (platform.startsWith('win')) {
    return 'Windows'
  } else if (platform.startsWith('mac')) {
    return 'macOS'
  } else if (platform.startsWith('linux')) {
    return 'Linux'
  } else if (platform.startsWith('chromeos')) {
    return 'ChromeOS'
  } else {
    return 'Unknown'
  }
}