import { redefinePropertyValues } from '../helpers.js';

const useragent = () => {
  const CHROME_VERSION = '141.0.0.0';
  const SHORT_CHROME_VERSION = CHROME_VERSION.split('.')[0];
  const PLATFORM_VERSION = '26.0.0';
  const BRAND_VERSION = '8.0.0.0';
  const SHORT_BRAND_VERSION = BRAND_VERSION.split('.')[0];
  const navigatorPrototype = self.Navigator || self.WorkerNavigator;
  const restoreNavigator = redefinePropertyValues(navigatorPrototype.prototype, {
    platform: 'MacIntel',
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`,
    appVersion: `5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`
  });
  const restoreNavigatorUAData = redefinePropertyValues(NavigatorUAData.prototype, {
    brands: [
      { brand: 'Google Chrome', version: SHORT_CHROME_VERSION },
      { brand: 'Not?A_Brand', version: SHORT_BRAND_VERSION },
      { brand: 'Chromium', version: SHORT_CHROME_VERSION }
    ],
    mobile: false,
    platform: 'MacIntel',
    getHighEntropyValues: async () => (
      {
        architecture: 'arm',
        bitness: '64',
        brands: [
          { brand: 'Google Chrome', version: SHORT_CHROME_VERSION },
          { brand: 'Not?A_Brand', version: SHORT_BRAND_VERSION },
          { brand: 'Chromium', version: SHORT_CHROME_VERSION }
        ],
        formFactors: [
          'Desktop'
        ],
        fullVersionList: [
          { brand: 'Google Chrome', version: CHROME_VERSION },
          { brand: 'Not?A_Brand', version: BRAND_VERSION },
          { brand: 'Chromium', version: CHROME_VERSION }
        ],
        mobile: false,
        model: '',
        platform: 'MacIntel',
        platformVersion: PLATFORM_VERSION,
        uaFullVersion: CHROME_VERSION,
        wow64: false
      })
  });
  return () => {
    restoreNavigator();
    restoreNavigatorUAData();
  };
};

export default useragent;
