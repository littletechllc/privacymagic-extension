# Privacy Magic browser extension

## Protections

* Blocks ads
* Blocks tracking scripts
* Blocks annoyances
* Removes tracking headers
* Blocks third-party cookies
* Blocks fingerprinting leaks
  * battery status
  * browser version
  * device information
  * disk space usage
  * display settings
  * graphics chip specs
  * keyboard layout
  * language settings
  * main chip specs
  * math processing
  * memory usage
  * network profile
  * screen details
  * system performance
  * time-zone settings
  * touch support status
* Removes tracking query parameters
* Caps Referrer-Policy
* Blocks insecure HTTP connections
* Blocks window.name tracking
* Sanitize IFrames
* Sanitize Web Workers
* Disable SharedStorage
* Disable ServiceWorkers
* Enables Global Privacy Control
* Disables WebRTC IP address leaks
* Disables browser "spy" features
* Disables Related Website Sets
* Disables Hyperlink Auditing
* Disables remote Spell Check Service

## Features

* Advanced: Enable and disable protections globally in options page
* Advanced: Enable and disable protections per-site in popup
* Protections are applied to top-level documents and iframes (including nested, sandboxed iframes)

## Third-party libraries

Third-party libraries imported using the npm package manager

### psl
* Copyright: (c) 2017 Lupo Montero lupomontero@gmail.com
* License: MIT
* Uses the Public-Suffix List to parse domain names and provide the registrable domain.

### punycode
* Copyright Mathias Bynens <https://mathiasbynens.be/>
* License: MIT
* Converts punycode domains to unicode.
