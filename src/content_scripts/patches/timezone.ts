

import { redefinePropertyValues, createSafeMethod } from '@src/content_scripts/helpers'

const timezone = (): void => {
  // Time zones that use fractional hour offsets can be coalesced to a
  // representative time zone. Must change its offset
  // on the same dates to coalesce properly.

  const
    AsiaKathmandu = 'Asia/Kathmandu'
  const AsiaKolkata = 'Asia/Kolkata'
  const AsiaTehran = 'Asia/Tehran'
  const AsiaYangon = 'Asia/Yangon'
  const AustraliaDarwin = 'Australia/Darwin'
  const PacificChatham = 'Pacific/Chatham'
  const PacificMarquesas = 'Pacific/Marquesas'

  const fractionHourTimeZoneMappings: Record<string, string> = {
    'Asia/Calcutta': AsiaKolkata,
    'Asia/Colombo': AsiaKolkata,
    'Asia/Kathmandu': AsiaKathmandu,
    'Asia/Katmandu': AsiaKathmandu,
    'Asia/Kolkata': AsiaKolkata,
    'Asia/Rangoon': AsiaYangon,
    'Asia/Tehran': AsiaTehran,
    'Asia/Yangon': AsiaYangon,
    'Australia/Darwin': AustraliaDarwin,
    'Australia/North': AustraliaDarwin,
    'Indian/Cocos': AsiaYangon,
    'Iran': AsiaTehran,
    'NZ-CHAT': PacificChatham,
    'Pacific/Chatham': PacificChatham,
    'Pacific/Marquesas': PacificMarquesas
  }

  // Time zones that use DST can be coalesced to a
  // representative time zone. Must change its offset
  // on the same dates to coalesce properly.

  const
    AfricaCairo = 'Africa/Cairo'
  const AfricaCasablanca = 'Africa/Casablanca'
  const AmericaAdak = 'America/Adak'
  const AmericaAnchorage = 'America/Anchorage'
  const AmericaChicago = 'America/Chicago'
  const AmericaDenver = 'America/Denver'
  const AmericaHalifax = 'America/Halifax'
  const AmericaLosAngeles = 'America/Los_Angeles'
  const AmericaMiquelon = 'America/Miquelon'
  const AmericaNewYork = 'America/New_York'
  const AmericaNuuk = 'America/Nuuk'
  const AmericaSantiago = 'America/Santiago'
  const AmericaStJohns = 'America/St_Johns'
  const AntarcticaTroll = 'Antarctica/Troll'
  const AsiaGaza = 'Asia/Gaza'
  const AsiaJerusalem = 'Asia/Jerusalem'
  const AtlanticAzores = 'Atlantic/Azores'
  const AustraliaAdelaide = 'Australia/Adelaide'
  const AustraliaLordHowe = 'Australia/Lord_Howe'
  const AustraliaSydney = 'Australia/Sydney'
  const EuropeAthens = 'Europe/Athens'
  const EuropeBerlin = 'Europe/Berlin'
  const EuropeLondon = 'Europe/London'
  const PacificAuckland = 'Pacific/Auckland'
  const PacificEaster = 'Pacific/Easter'
  const PacificNorfolk = 'Pacific/Norfolk'

  const dstTimeZoneMappings: { [key: string]: string } = {

    // HST -> HDT
    'America/Adak': AmericaAdak,
    'America/Atka': AmericaAdak,
    'US/Aleutian': AmericaAdak,

    // AKST -> AKDT
    'America/Anchorage': AmericaAnchorage,
    'America/Juneau': AmericaAnchorage,
    'America/Metlakatla': AmericaAnchorage,
    'America/Nome': AmericaAnchorage,
    'America/Sitka': AmericaAnchorage,
    'America/Yakutat': AmericaAnchorage,
    'US/Alaska': AmericaAnchorage,

    // PST -> PDT
    'America/Ensenada': AmericaLosAngeles,
    'America/Los_Angeles': AmericaLosAngeles,
    'America/Santa_Isabel': AmericaLosAngeles,
    'America/Tijuana': AmericaLosAngeles,
    'America/Vancouver': AmericaLosAngeles,
    'Canada/Pacific': AmericaLosAngeles,
    'Mexico/BajaNorte': AmericaLosAngeles,
    'PST8PDT': AmericaLosAngeles,
    'US/Pacific': AmericaLosAngeles,

    // MST -> MDT
    'America/Boise': AmericaDenver,
    'America/Cambridge_Bay': AmericaDenver,
    'America/Ciudad_Juarez': AmericaDenver,
    'America/Denver': AmericaDenver,
    'America/Edmonton': AmericaDenver,
    'America/Inuvik': AmericaDenver,
    'America/Shiprock': AmericaDenver,
    'America/Yellowknife': AmericaDenver,
    'Canada/Mountain': AmericaDenver,
    'MST7MDT': AmericaDenver,
    'Navajo': AmericaDenver,
    'US/Mountain': AmericaDenver,

    // -6 -> -5
    'Chile/EasterIsland': PacificEaster,
    'Pacific/Easter': PacificEaster,

    // CST -> CDT
    'America/Chicago': AmericaChicago,
    'America/Indiana/Knox': AmericaChicago,
    'America/Indiana/Tell_City': AmericaChicago,
    'America/Knox_IN': AmericaChicago,
    'America/Matamoros': AmericaChicago,
    'America/Menominee': AmericaChicago,
    'America/North_Dakota/Beulah': AmericaChicago,
    'America/North_Dakota/Center': AmericaChicago,
    'America/North_Dakota/New_Salem': AmericaChicago,
    'America/Ojinaga': AmericaChicago,
    'America/Rainy_River': AmericaChicago,
    'America/Rankin_Inlet': AmericaChicago,
    'America/Resolute': AmericaChicago,
    'America/Winnipeg': AmericaChicago,
    'Canada/Central': AmericaChicago,
    'CST6CDT': AmericaChicago,
    'US/Central': AmericaChicago,
    'US/Indiana-Starke': AmericaChicago,

    // EST -> EDT
    'America/Detroit': AmericaNewYork,
    'America/Fort_Wayne': AmericaNewYork,
    'America/Grand_Turk': AmericaNewYork,
    'America/Indiana/Indianapolis': AmericaNewYork,
    'America/Indiana/Marengo': AmericaNewYork,
    'America/Indiana/Petersburg': AmericaNewYork,
    'America/Indiana/Vevay': AmericaNewYork,
    'America/Indiana/Vincennes': AmericaNewYork,
    'America/Indiana/Winamac': AmericaNewYork,
    'America/Iqaluit': AmericaNewYork,
    'America/Kentucky/Louisville': AmericaNewYork,
    'America/Kentucky/Monticello': AmericaNewYork,
    'America/Louisville': AmericaNewYork,
    'America/Montreal': AmericaNewYork,
    'America/Nassau': AmericaNewYork,
    'America/New_York': AmericaNewYork,
    'America/Nipigon': AmericaNewYork,
    'America/Pangnirtung': AmericaNewYork,
    'America/Port-au-Prince': AmericaNewYork,
    'America/Thunder_Bay': AmericaNewYork,
    'America/Toronto': AmericaNewYork,
    'Canada/Eastern': AmericaNewYork,
    'EST5EDT': AmericaNewYork,
    'US/East-Indiana': AmericaNewYork,
    'US/Eastern': AmericaNewYork,
    'US/Michigan': AmericaNewYork,
    'US/Northwest-Indiana': AmericaNewYork,

    // -04 -> -03
    'America/Santiago': AmericaSantiago,
    'Chile/Continental': AmericaSantiago,

    // AST -> ADT
    'America/Glace_Bay': AmericaHalifax,
    'America/Goose_Bay': AmericaHalifax,
    'America/Halifax': AmericaHalifax,
    'America/Moncton': AmericaHalifax,
    'America/Thule': AmericaHalifax,
    'Atlantic/Bermuda': AmericaHalifax,
    'Canada/Atlantic': AmericaHalifax,

    // NST -> NDT
    'America/St_Johns': AmericaStJohns,
    'Canada/Newfoundland': AmericaStJohns,

    // -03 -> -02
    'America/Miquelon': AmericaMiquelon,

    // -02 -> -01
    'America/Godthab': AmericaNuuk,
    'America/Nuuk': AmericaNuuk,
    'America/Scoresbysund': AmericaNuuk,

    // -01 -> +00
    'Atlantic/Azores': AtlanticAzores,

    // +00 -> +02
    'Antarctica/Troll': AntarcticaTroll,

    // WET -> WEST (equivalent to GMT -> BST)
    'Atlantic/Canary': EuropeLondon,
    'Atlantic/Faeroe': EuropeLondon,
    'Atlantic/Faroe': EuropeLondon,
    'Atlantic/Madeira': EuropeLondon,
    'Europe/Lisbon': EuropeLondon,
    'Portugal': EuropeLondon,
    'WET': EuropeLondon,

    // GMT -> BST
    'Europe/Belfast': EuropeLondon,
    'Europe/Guernsey': EuropeLondon,
    'Europe/Isle_of_Man': EuropeLondon,
    'Europe/Jersey': EuropeLondon,
    'Europe/London': EuropeLondon,
    'GB-Eire': EuropeLondon,
    'GB': EuropeLondon,

    // GMT -> IST (equivalent to GMT -> BST)
    'Eire': EuropeLondon,
    'Europe/Dublin': EuropeLondon,

    // +1 -> +00
    'Africa/Casablanca': AfricaCasablanca,
    'Africa/El_Aaiun': AfricaCasablanca,

    // CET -> CEST
    'Africa/Ceuta': EuropeBerlin,
    'Arctic/Longyearbyen': EuropeBerlin,
    'Atlantic/Jan_Mayen': EuropeBerlin,
    'CET': EuropeBerlin,
    'Europe/Amsterdam': EuropeBerlin,
    'Europe/Andorra': EuropeBerlin,
    'Europe/Belgrade': EuropeBerlin,
    'Europe/Berlin': EuropeBerlin,
    'Europe/Bratislava': EuropeBerlin,
    'Europe/Brussels': EuropeBerlin,
    'Europe/Budapest': EuropeBerlin,
    'Europe/Busingen': EuropeBerlin,
    'Europe/Copenhagen': EuropeBerlin,
    'Europe/Gibraltar': EuropeBerlin,
    'Europe/Ljubljana': EuropeBerlin,
    'Europe/Luxembourg': EuropeBerlin,
    'Europe/Madrid': EuropeBerlin,
    'Europe/Malta': EuropeBerlin,
    'Europe/Monaco': EuropeBerlin,
    'Europe/Oslo': EuropeBerlin,
    'Europe/Paris': EuropeBerlin,
    'Europe/Podgorica': EuropeBerlin,
    'Europe/Prague': EuropeBerlin,
    'Europe/Rome': EuropeBerlin,
    'Europe/San_Marino': EuropeBerlin,
    'Europe/Sarajevo': EuropeBerlin,
    'Europe/Skopje': EuropeBerlin,
    'Europe/Stockholm': EuropeBerlin,
    'Europe/Tirane': EuropeBerlin,
    'Europe/Vaduz': EuropeBerlin,
    'Europe/Vatican': EuropeBerlin,
    'Europe/Vienna': EuropeBerlin,
    'Europe/Warsaw': EuropeBerlin,
    'Europe/Zagreb': EuropeBerlin,
    'Europe/Zurich': EuropeBerlin,
    'MET': EuropeBerlin,
    'Poland': EuropeBerlin,

    // Nonconforming EET -> EEST
    'Africa/Cairo': AfricaCairo,
    'Asia/Gaza': AsiaGaza,
    'Asia/Hebron': AsiaGaza,
    'Egypt': AfricaCairo,

    // EET -> EEST
    'Asia/Beirut': EuropeAthens,
    'Asia/Famagusta': EuropeAthens,
    'Asia/Nicosia': EuropeAthens,
    'EET': EuropeAthens,
    'Europe/Athens': EuropeAthens,
    'Europe/Bucharest': EuropeAthens,
    'Europe/Chisinau': EuropeAthens,
    'Europe/Helsinki': EuropeAthens,
    'Europe/Kiev': EuropeAthens,
    'Europe/Kyiv': EuropeAthens,
    'Europe/Mariehamn': EuropeAthens,
    'Europe/Nicosia': EuropeAthens,
    'Europe/Riga': EuropeAthens,
    'Europe/Sofia': EuropeAthens,
    'Europe/Tallinn': EuropeAthens,
    'Europe/Tiraspol': EuropeAthens,
    'Europe/Uzhgorod': EuropeAthens,
    'Europe/Vilnius': EuropeAthens,
    'Europe/Zaporozhye': EuropeAthens,

    // Israel
    'Asia/Jerusalem': AsiaJerusalem,
    'Asia/Tel_Aviv': AsiaJerusalem,
    'Israel': AsiaJerusalem,

    // ACST -> ACDT
    'Australia/Adelaide': AustraliaAdelaide,
    'Australia/Broken_Hill': AustraliaAdelaide,
    'Australia/South': AustraliaAdelaide,
    'Australia/Yancowinna': AustraliaAdelaide,

    // AEST -> AEDT
    'Antarctica/Macquarie': AustraliaSydney,
    'Australia/ACT': AustraliaSydney,
    'Australia/Canberra': AustraliaSydney,
    'Australia/Currie': AustraliaSydney,
    'Australia/Hobart': AustraliaSydney,
    'Australia/Melbourne': AustraliaSydney,
    'Australia/NSW': AustraliaSydney,
    'Australia/Sydney': AustraliaSydney,
    'Australia/Tasmania': AustraliaSydney,
    'Australia/Victoria': AustraliaSydney,

    // +10:30 -> +11:30
    'Australia/LHI': AustraliaLordHowe,
    'Australia/Lord_Howe': AustraliaLordHowe,

    // +11 -> +12
    'Pacific/Norfolk': PacificNorfolk,

    // NZST -> NZDT
    'Antarctica/McMurdo': PacificAuckland,
    'Antarctica/South_Pole': PacificAuckland,
    'NZ': PacificAuckland,
    'Pacific/Auckland': PacificAuckland

  }

  const roundTimeZoneRepresentatives: Record<string, string> = {
    '-12': 'Etc/GMT+12',
    '-11': 'Pacific/Pago_Pago',
    '-10': 'Pacific/Honolulu',
    '-9': 'Pacific/Gambier',
    '-8': 'Pacific/Pitcairn',
    '-7': 'America/Phoenix',
    '-6': 'America/Guatemala',
    '-5': 'America/Panama',
    '-4': 'America/Puerto_Rico',
    '-3': 'America/Argentina/Buenos_Aires',
    '-2': 'Atlantic/South_Georgia',
    '-1': 'Africa/Cape_Verde',
    '0': 'Africa/Abidjan',
    '1': 'Africa/Lagos',
    '2': 'Africa/Maputo',
    '3': 'Africa/Nairobi',
    '4': 'Asia/Dubai',
    '5': 'Asia/Ashgabat',
    '6': 'Asia/Dhaka',
    '7': 'Asia/Bangkok',
    '8': 'Asia/Shanghai',
    '9': 'Asia/Tokyo',
    '10': 'Pacific/Port_Moresby',
    '11': 'Pacific/Guadalcanal',
    '12': 'Pacific/Tarawa',
    '13': 'Pacific/Kanton',
    '14': 'Pacific/Kiritimati'
  }

  const originalResolvedOptionsSafe = createSafeMethod(Intl.DateTimeFormat, 'resolvedOptions')
  const originalMathTrunc = Math.trunc
  const originalDateGetTimezoneOffsetSafe = createSafeMethod(Date, 'getTimezoneOffset')
  const OriginalDate = Date
  redefinePropertyValues(Intl.DateTimeFormat.prototype, {
    resolvedOptions: function (this: Intl.DateTimeFormat) {
      const options = originalResolvedOptionsSafe(this)
      const now = new OriginalDate()
      // negative to match ISO 8061 sign convention:
      const offsetMinutes = -originalDateGetTimezoneOffsetSafe(now)
      const hours = originalMathTrunc(offsetMinutes / 60)
      const minutes = offsetMinutes % 60
      // If the time zone uses DST, return the DST representative time zone.
      const dstRepresentativeTimeZone = dstTimeZoneMappings[options.timeZone]
      if (dstRepresentativeTimeZone !== undefined && dstRepresentativeTimeZone !== '') {
        return { ...options, timeZone: dstRepresentativeTimeZone }
      }
      // If the time zone has a minute offset, return the coalesced time zone.
      if (minutes !== 0) {
        const fractionalHourRepresentativeTimeZone = fractionHourTimeZoneMappings[options.timeZone] ?? options.timeZone
        return { ...options, timeZone: fractionalHourRepresentativeTimeZone }
      }
      // If the time zone is a round number of hours, return a representative time zone.
      const roundTimeZoneRepresentative = roundTimeZoneRepresentatives[hours.toString()]
      if (roundTimeZoneRepresentative !== undefined && roundTimeZoneRepresentative !== '') {
        return { ...options, timeZone: roundTimeZoneRepresentative }
      }
      // Otherwise, return the Etc/GMT+n or Etc/GMT-n representative time zone.
      // Negative to match the Etc/ sign convention.
      const etcTimeZone = `Etc/GMT${hours > 0 ? '-' + String(hours) : '+' + String(-hours)}`
      return { ...options, timeZone: etcTimeZone }
    }
  })
}

export default timezone
