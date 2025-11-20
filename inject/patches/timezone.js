/* global */

import { reflectApplySafe, redefinePropertyValues } from '../helpers.js';

const timezone = () => {
  const coalescingTimeZones = {
    'Asia/Calcutta': 'Asia/Kolkata',
    'Asia/Katmandu': 'Asia/Kathmandu',
    'Asia/Rangoon': 'Asia/Yangon',
    'Australia/LHI': 'Australia/Lord_Howe',
    'Australia/North': 'Australia/Darwin',
    'Australia/South': 'Australia/Adelaide',
    'Australia/Yancowinna': 'Australia/Broken_Hill',
    'Canada/Newfoundland': 'America/St_Johns',
    'Indian/Cocos': 'Asia/Yangon',
    'Iran': 'Asia/Tehran', // eslint-disable-line quote-props
    'NZ-CHAT': 'Pacific/Chatham'
  };
  const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  const originalResolvedOptionsSafe = (intlDateTimeFormat) => reflectApplySafe(originalResolvedOptions, intlDateTimeFormat, []);
  return redefinePropertyValues(Intl.DateTimeFormat.prototype, {
    resolvedOptions: function () {
      const options = originalResolvedOptionsSafe(this);
      const now = new Date();
      // negative to match ISO 8061 sign convention:
      const offsetMinutes = -now.getTimezoneOffset();
      const hours = Math.trunc(offsetMinutes / 60);
      const minutes = Math.abs(offsetMinutes % 60);
      if (minutes !== 0) {
        const coalescedTimeZone = coalescingTimeZones[options.timeZone] || options.timeZone;
        return { ...options, timeZone: coalescedTimeZone };
      }
      if (hours === 0) {
        return { ...options, timeZone: 'Etc/GMT' };
      }
      const etcTimeZone = `Etc/GMT${hours > 0 ? '+' + hours : '-' + (-hours)}`;
      return { ...options, timeZone: etcTimeZone };
    }
  });
};

export default timezone;
