/* global */
/* eslint-disable quote-props */

import { reflectApplySafe, redefinePropertyValues } from '../helpers.js';

const timezone = () => {
  // Time zones that use fractional hour offsets can be coalesced to a
  // representative time zone. Must change its offset
  // on the same dates to coalesce properly.
  const fractionHourTimeZoneMappings = {

    'Asia/Calcutta': 'Asia/Kolkata',
    'Asia/Colombo': 'Asia/Kolkata',
    'Asia/Kathmandu': 'Asia/Kathmandu',
    'Asia/Katmandu': 'Asia/Kathmandu',
    'Asia/Kolkata': 'Asia/Kolkata',
    'Asia/Rangoon': 'Asia/Yangon',
    'Asia/Tehran': 'Asia/Tehran',
    'Asia/Yangon': 'Asia/Yangon',
    'Australia/Darwin': 'Australia/Darwin',
    'Australia/North': 'Australia/Darwin',
    'Indian/Cocos': 'Asia/Yangon',
    'Iran': 'Asia/Tehran',
    'NZ-CHAT': 'Pacific/Chatham',
    'Pacific/Chatham': 'Pacific/Chatham'
  };

  // Time zones that use DST can be coalesced to a
  // representative time zone. Must change its offset
  // on the same dates to coalesce properly.
  const dstTimeZoneMappings = {

    // HST -> HDT
    'America/Adak': 'America/Adak',
    'America/Atka': 'America/Adak',
    'US/Aleutian': 'America/Adak',

    // AKST -> AKDT
    'America/Anchorage': 'America/Anchorage',
    'America/Juneau': 'America/Anchorage',
    'America/Metlakatla': 'America/Anchorage',
    'America/Nome': 'America/Anchorage',
    'America/Sitka': 'America/Anchorage',
    'America/Yakutat': 'America/Anchorage',
    'US/Alaska': 'America/Anchorage',

    // PST -> PDT
    'America/Ensenada': 'America/Los_Angeles',
    'America/Los_Angeles': 'America/Los_Angeles',
    'America/Santa_Isabel': 'America/Los_Angeles',
    'America/Tijuana': 'America/Los_Angeles',
    'America/Vancouver': 'America/Los_Angeles',
    'Canada/Pacific': 'America/Los_Angeles',
    'Mexico/BajaNorte': 'America/Los_Angeles',
    'PST8PDT': 'America/Los_Angeles',
    'US/Pacific': 'America/Los_Angeles',

    // MST -> MDT
    'America/Boise': 'America/Denver',
    'America/Cambridge_Bay': 'America/Denver',
    'America/Ciudad_Juarez': 'America/Denver',
    'America/Denver': 'America/Denver',
    'America/Edmonton': 'America/Denver',
    'America/Inuvik': 'America/Denver',
    'America/Shiprock': 'America/Denver',
    'America/Yellowknife': 'America/Denver',
    'Canada/Mountain': 'America/Denver',
    'MST7MDT': 'America/Denver',
    'Navajo': 'America/Denver',
    'US/Mountain': 'America/Denver',

    // -6 -> -5
    'Pacific/Easter': 'Pacific/Easter',
    'Chile/EasterIsland': 'Pacific/Easter',

    // CST -> CDT
    'America/Indiana/Knox': 'America/Chicago',
    'America/Indiana/Tell_City': 'America/Chicago',
    'America/Knox_IN': 'America/Chicago',
    'America/Chicago': 'America/Chicago',
    'America/Matamoros': 'America/Chicago',
    'America/Menominee': 'America/Chicago',
    'America/North_Dakota/Beulah': 'America/Chicago',
    'America/North_Dakota/Center': 'America/Chicago',
    'America/North_Dakota/New_Salem': 'America/Chicago',
    'America/Ojinaga': 'America/Chicago',
    'America/Rainy_River': 'America/Chicago',
    'America/Rankin_Inlet': 'America/Chicago',
    'America/Resolute': 'America/Chicago',
    'America/Winnipeg': 'America/Chicago',
    'Canada/Central': 'America/Chicago',
    'CST6CDT': 'America/Chicago',
    'US/Central': 'America/Chicago',
    'US/Indiana-Starke': 'America/Chicago',

    // EST -> EDT
    'America/Detroit': 'America/New_York',
    'America/Fort_Wayne': 'America/New_York',
    'America/Grand_Turk': 'America/New_York',
    'America/Indiana/Indianapolis': 'America/New_York',
    'America/Indiana/Marengo': 'America/New_York',
    'America/Indiana/Petersburg': 'America/New_York',
    'America/Indiana/Vevay': 'America/New_York',
    'America/Indiana/Vincennes': 'America/New_York',
    'America/Indiana/Winamac': 'America/New_York',
    'America/Iqaluit': 'America/New_York',
    'America/Kentucky/Louisville': 'America/New_York',
    'America/Kentucky/Monticello': 'America/New_York',
    'America/Louisville': 'America/New_York',
    'America/Montreal': 'America/New_York',
    'America/Nassau': 'America/New_York',
    'America/New_York': 'America/New_York',
    'America/Nipigon': 'America/New_York',
    'America/Pangnirtung': 'America/New_York',
    'America/Port-au-Prince': 'America/New_York',
    'America/Thunder_Bay': 'America/New_York',
    'America/Toronto': 'America/New_York',
    'Canada/Eastern': 'America/New_York',
    'EST5EDT': 'America/New_York',
    'US/East-Indiana': 'America/New_York',
    'US/Eastern': 'America/New_York',
    'US/Michigan': 'America/New_York',
    'US/Northwest-Indiana': 'America/New_York',

    // -04 -> -03
    'America/Santiago': 'America/Santiago',
    'Chile/Continental': 'America/Santiago',

    // AST -> ADT
    'America/Glace_Bay': 'America/Halifax',
    'America/Goose_Bay': 'America/Halifax',
    'America/Halifax': 'America/Halifax',
    'America/Moncton': 'America/Halifax',
    'America/Thule': 'America/Halifax',
    'Atlantic/Bermuda': 'America/Halifax',
    'Canada/Atlantic': 'America/Halifax',

    // NST -> NDT
    'America/St_Johns': 'America/St_Johns',
    'Canada/Newfoundland': 'America/St_Johns',

    // -03 -> -02
    'America/Miquelon': 'America/Miquelon',

    // -02 -> -01
    'America/Godthab': 'America/Nuuk',
    'America/Nuuk': 'America/Nuuk',
    'America/Scoresbysund': 'America/Nuuk',

    // -01 -> +00
    'Atlantic/Azores': 'Atlantic/Azores',

    // +00 -> +02
    'Antarctica/Troll': 'Antarctica/Troll',

    // WET -> WEST (equivalent to GMT -> BST)
    'Atlantic/Canary': 'Europe/London',
    'Atlantic/Faeroe': 'Europe/London',
    'Atlantic/Faroe': 'Europe/London',
    'Atlantic/Madeira': 'Europe/London',
    'Europe/Lisbon': 'Europe/London',
    'Portugal': 'Europe/London',
    'WET': 'Europe/London',

    // GMT -> BST
    'Europe/Belfast': 'Europe/London',
    'Europe/Guernsey': 'Europe/London',
    'Europe/Isle_of_Man': 'Europe/London',
    'Europe/Jersey': 'Europe/London',
    'Europe/London': 'Europe/London',
    'GB': 'Europe/London',
    'GB-Eire': 'Europe/London',

    // GMT -> IST (equivalent to GMT -> BST)
    'Eire': 'Europe/London',
    'Europe/Dublin': 'Europe/London',

    // +1 -> +00
    'Africa/Casablanca': 'Africa/Casablanca',
    'Africa/El_Aaiun': 'Africa/Casablanca',

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

    // Nonconforming EET -> EEST
    'Asia/Hebron': 'Asia/Gaza',
    'Asia/Gaza': 'Asia/Gaza',
    'Egypt': 'Africa/Cairo',
    'Africa/Cairo': 'Africa/Cairo',

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

    // Israel
    'Asia/Jerusalem': 'Asia/Jerusalem',
    'Asia/Tel_Aviv': 'Asia/Jerusalem',
    'Israel': 'Asia/Jerusalem',

    // ACST -> ACDT
    'Australia/Adelaide': 'Australia/Adelaide',
    'Australia/Broken_Hill': 'Australia/Adelaide',
    'Australia/South': 'Australia/Adelaide',
    'Australia/Yancowinna': 'Australia/Adelaide',

    // AEST -> AEDT
    'Antarctica/Macquarie': 'Australia/Sydney',
    'Australia/ACT': 'Australia/Sydney',
    'Australia/Canberra': 'Australia/Sydney',
    'Australia/Currie': 'Australia/Sydney',
    'Australia/Hobart': 'Australia/Sydney',
    'Australia/Melbourne': 'Australia/Sydney',
    'Australia/NSW': 'Australia/Sydney',
    'Australia/Sydney': 'Australia/Sydney',
    'Australia/Tasmania': 'Australia/Sydney',
    'Australia/Victoria': 'Australia/Sydney',

    // +10:30 -> +11:30
    'Australia/Lord_Howe': 'Australia/Lord_Howe',
    'Australia/LHI': 'Australia/Lord_Howe',

    // +11 -> +12
    'Pacific/Norfolk': 'Pacific/Norfolk',

    // NZST -> NZDT
    'Antarctica/McMurdo': 'Pacific/Auckland',
    'Antarctica/South_Pole': 'Pacific/Auckland',
    'Pacific/Auckland': 'Pacific/Auckland',
    'NZ': 'Pacific/Auckland',

    // +12:45 -> +13:45
    'NZ-CHAT': 'Pacific/Chatham',
    'Pacific/Chatham': 'Pacific/Chatham'
  };
  const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  const originalResolvedOptionsSafe = (intlDateTimeFormat) => reflectApplySafe(originalResolvedOptions, intlDateTimeFormat, []);
  const originalMathTrunc = Math.trunc;
  const originalDateGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  const originalDateGetTimezoneOffsetSafe = (date) => reflectApplySafe(originalDateGetTimezoneOffset, date, []);
  const OriginalDate = Date;
  return redefinePropertyValues(Intl.DateTimeFormat.prototype, {
    resolvedOptions: function () {
      const options = originalResolvedOptionsSafe(this);
      const now = new OriginalDate();
      // negative to match ISO 8061 sign convention:
      const offsetMinutes = -originalDateGetTimezoneOffsetSafe(now);
      const hours = originalMathTrunc(offsetMinutes / 60);
      const minutes = offsetMinutes % 60;
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
