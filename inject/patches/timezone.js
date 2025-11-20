/* global */
/* eslint-disable quote-props */

import { reflectApplySafe, redefinePropertyValues } from '../helpers.js';

const timezone = () => {
  const fractionHourTimeZoneMappings = {
    'America/St_Johns': 'America/St_Johns',
    'Asia/Calcutta': 'Asia/Kolkata',
    'Asia/Colombo': 'Asia/Kolkata',
    'Asia/Kathmandu': 'Asia/Kathmandu',
    'Asia/Katmandu': 'Asia/Kathmandu',
    'Asia/Kolkata': 'Asia/Kolkata',
    'Asia/Rangoon': 'Asia/Yangon',
    'Asia/Tehran': 'Asia/Tehran',
    'Asia/Yangon': 'Asia/Yangon',
    'Australia/Adelaide': 'Australia/Adelaide',
    'Australia/Broken_Hill': 'Australia/Adelaide',
    'Australia/Darwin': 'Australia/Darwin',
    'Australia/LHI': 'Australia/Lord_Howe',
    'Australia/Lord_Howe': 'Australia/Lord_Howe',
    'Australia/North': 'Australia/Darwin',
    'Australia/South': 'Australia/Adelaide',
    'Australia/Yancowinna': 'Australia/Adelaide',
    'Canada/Newfoundland': 'America/St_Johns',
    'Indian/Cocos': 'Asia/Yangon',
    'Iran': 'Asia/Tehran',
    'NZ-CHAT': 'Pacific/Chatham',
    'Pacific/Chatham': 'Pacific/Chatham'
  };
  const dstTimeZoneMappings = {
    // GMT -> BST
    'Europe/Belfast': 'Europe/London',
    'Europe/Guernsey': 'Europe/London',
    'Europe/Isle_of_Man': 'Europe/London',
    'Europe/Jersey': 'Europe/London',
    'Europe/London': 'Europe/London',
    'GB': 'Europe/London',
    'GB-Eire': 'Europe/London',

    // WET -> WEST (equivalent to GMT -> BST)
    'Atlantic/Faeroe': 'Europe/London',
    'Atlantic/Faroe': 'Europe/London',
    'Atlantic/Madeira': 'Europe/London',
    'Europe/Lisbon': 'Europe/London',
    'Portugal': 'Europe/London',
    'WET': 'Europe/London',

    // GMT -> IST (equivalent to GMT -> BST)
    'Eire': 'Europe/London',
    'Europe/Dublin': 'Europe/London',

    // CET -> CEST
    'Africa/Ceuta': 'Europe/Berlin',
    'Arctic/Longyearbyen': 'Europe/Berlin',
    'Atlantic/Jan_Mayen': 'Europe/Berlin',
    'CET': 'Europe/Berlin',
    'Europe/Amsterdam': 'Europe/Berlin',
    'Europe/Andorra': 'Europe/Berlin',
    'Europe/Belgrade': 'Europe/Berlin',
    'Europe/Berlin': 'Europe/Berlin',
    'Europe/Bratislava': 'Europe/Berlin',
    'Europe/Brussels': 'Europe/Berlin',
    'Europe/Budapest': 'Europe/Berlin',
    'Europe/Busingen': 'Europe/Berlin',
    'Europe/Copenhagen': 'Europe/Berlin',
    'Europe/Gibraltar': 'Europe/Berlin',
    'Europe/Ljubljana': 'Europe/Berlin',
    'Europe/Luxembourg': 'Europe/Berlin',
    'Europe/Madrid': 'Europe/Berlin',
    'Europe/Malta': 'Europe/Berlin',
    'Europe/Monaco': 'Europe/Berlin',
    'Europe/Oslo': 'Europe/Berlin',
    'Europe/Paris': 'Europe/Berlin',
    'Europe/Podgorica': 'Europe/Berlin',
    'Europe/Prague': 'Europe/Berlin',
    'Europe/Rome': 'Europe/Berlin',
    'Europe/San_Marino': 'Europe/Berlin',
    'Europe/Sarajevo': 'Europe/Berlin',
    'Europe/Skopje': 'Europe/Berlin',
    'Europe/Stockholm': 'Europe/Berlin',
    'Europe/Tirane': 'Europe/Berlin',
    'Europe/Vaduz': 'Europe/Berlin',
    'Europe/Vatican': 'Europe/Berlin',
    'Europe/Vienna': 'Europe/Berlin',
    'Europe/Warsaw': 'Europe/Berlin',
    'Europe/Zagreb': 'Europe/Berlin',
    'Europe/Zurich': 'Europe/Berlin',
    'MET': 'Europe/Berlin',
    'Poland': 'Europe/Berlin',

    // EET -> EEST
    'Asia/Beirut': 'Europe/Athens',
    'Asia/Famagusta': 'Europe/Athens',
    'Asia/Nicosia': 'Europe/Athens',
    'EET': 'Europe/Athens',
    'Europe/Athens': 'Europe/Athens',
    'Europe/Bucharest': 'Europe/Athens',
    'Europe/Chisinau': 'Europe/Athens',
    'Europe/Helsinki': 'Europe/Athens',
    'Europe/Kiev': 'Europe/Athens',
    'Europe/Kyiv': 'Europe/Athens',
    'Europe/Mariehamn': 'Europe/Athens',
    'Europe/Nicosia': 'Europe/Athens',
    'Europe/Riga': 'Europe/Athens',
    'Europe/Sofia': 'Europe/Athens',
    'Europe/Tallinn': 'Europe/Athens',
    'Europe/Tiraspol': 'Europe/Athens',
    'Europe/Uzhgorod': 'Europe/Athens',
    'Europe/Vilnius': 'Europe/Athens',
    'Europe/Zaporozhye': 'Europe/Athens',

    // Nonconforming EET -> EEST
    'Asia/Hebron': 'Asia/Gaza',
    'Asia/Gaza': 'Asia/Gaza',
    'Egypt': 'Africa/Cairo',
    'Africa/Cairo': 'Africa/Cairo',

    // Israel
    'Asia/Jerusalem': 'Asia/Jerusalem',
    'Asia/Tel_Aviv': 'Asia/Jerusalem',
    'Israel': 'Asia/Jerusalem'
  };
  const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  const originalResolvedOptionsSafe = (intlDateTimeFormat) => reflectApplySafe(originalResolvedOptions, intlDateTimeFormat, []);
  return redefinePropertyValues(Intl.DateTimeFormat.prototype, {
    resolvedOptions: function () {
      const options = originalResolvedOptionsSafe(this);
      console.log('original time zone: ', options.timeZone);
      const now = new Date();
      // negative to match ISO 8061 sign convention:
      const offsetMinutes = -now.getTimezoneOffset();
      const hours = Math.trunc(offsetMinutes / 60);
      const minutes = Math.abs(offsetMinutes % 60);
      // If the time zone has a minute offset, return the coalesced time zone.
      if (minutes !== 0) {
        const fractionalHourRepresentativeTimeZone = fractionHourTimeZoneMappings[options.timeZone] || options.timeZone;
        return { ...options, timeZone: fractionalHourRepresentativeTimeZone };
      }
      // If the time zone uses DST, return the DST representative time zone.
      const dstRepresentativeTimeZone = dstTimeZoneMappings[options.timeZone];
      if (dstRepresentativeTimeZone) {
        return { ...options, timeZone: dstRepresentativeTimeZone };
      }
      // If the time zone is UTC, return the UTC representative time zone.
      if (hours === 0) {
        return { ...options, timeZone: 'Etc/GMT' };
      }
      // Otherwise, return the Etc/GMT+n or Etc/GMT-n representative time zone.
      // Negative to match the Etc/ sign convention.
      const etcTimeZone = `Etc/GMT${hours > 0 ? '-' + hours : '+' + (-hours)}`;
      return { ...options, timeZone: etcTimeZone };
    }
  });
};

export default timezone;
