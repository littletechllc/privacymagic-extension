const CHROME_PRIVACY_PREF_SETTINGS = {
  "adMeasurementEnabled": false,
  "doNotTrackEnabled": true,
  "fledgeEnabled": false,
  "hyperlinkAuditingEnabled": false,
  "protectedContentEnabled": false,
  "referrersEnabled": false,
  "relatedWebsiteSetsEnabled": false,
  "thirdPartyCookiesAllowed": false,
  "topicsEnabled": false,
}

export const setChromePrivacyPrefs = () => Promise.allSettled(
  Object.entries(CHROME_PRIVACY_PREF_SETTINGS).map(async ([key, value]) => {
    if (chrome.privacy.websites[key] !== undefined) {
      await chrome.privacy.websites[key].set({value});
    }
  })
)
