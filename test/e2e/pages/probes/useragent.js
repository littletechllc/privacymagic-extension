async function runProbe () {
  const ua = navigator.userAgentData
  if (ua == null) {
    throw new Error('navigator.userAgentData is unavailable')
  }
  const hints = await ua.getHighEntropyValues(['fullVersionList', 'uaFullVersion'])
  return {
    platform: navigator.platform,
    uaPlatform: ua.platform,
    mobile: ua.mobile,
    json: ua.toJSON(),
    fullVersionListAbsent: !('fullVersionList' in hints),
    uaFullVersionAbsent: !('uaFullVersion' in hints)
  }
}
