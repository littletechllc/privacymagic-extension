export const PRIVACY_SETTINGS_CONFIG = {
  blocking: {
    ads: {
      dnr: true,
      script: true
    }
  },
  connections: {
    client_hints: {
      dnr: true
    },
    headers: {
      dnr: true
    },
    query_parameters: {
      dnr: true
    },
  },
  fingerprinting: {
    do_not_track: {
      script: true,
      dnr: true,
    },
    hardware: {
      script: true
    },
    screen: {
      script: true
    },
    window_name: {
      script: true
    },
  }
};