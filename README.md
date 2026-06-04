# Privacy Magic browser extension

## Protections

* Blocks ads
* Blocks tracking scripts
* Blocks annoyances
* Removes tracking headers
* Blocks third-party cookies
* Blocks fingerprinting leaks
  * audio processing
  * battery status
  * browser version
  * device information
  * disk space usage
  * display settings
  * fonts installed
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
* Sanitizes IFrames
* Sanitizes Web Workers
* Disables SharedStorage
* Disables ServiceWorkers
* Enables Global Privacy Control
* Disables WebRTC IP address leaks
* Disables browser "spy" features
* Disables Related Website Sets
* Disables Hyperlink Auditing
* Disables remote Spell Check Service

## Additional planned fingerprinting protections:
  * SharedWorker
  * OffscreenCanvas
  * WebGL2
  * Non macOS vendor spoofing
  * AudioWorklet
  * iframe hardening for contentDocument.defaultView, window.frames[]

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

## Third-party lists

Filter subscriptions downloaded at build time (`tools/filter-list-processor.ts`) and converted into network, cosmetic, procedural, and scriptlet rules shipped in the extension.

### EasyList
* Copyright: The EasyList authors (<https://easylist.to/>)
* License: GNU General Public License v3.0 or later, or Creative Commons Attribution-ShareAlike 3.0 Unported (at your option; see <https://easylist.to/pages/licence.html>)
* Source: <https://easylist.to/easylist/easylist.txt>
* Primary ad-blocking rules (banners, ad networks, and related annoyances on web pages).

### EasyPrivacy
* Copyright: The EasyList authors (<https://easylist.to/>)
* License: GNU General Public License v3.0 or later, or Creative Commons Attribution-ShareAlike 3.0 Unported (at your option; see <https://easylist.to/pages/licence.html>)
* Source: <https://easylist.to/easylist/easyprivacy.txt>
* Tracking and analytics blocking rules (trackers, beacons, and similar third-party requests).

### Fanboy's Annoyance List
* Copyright: Fanboy (<https://fanboy.co.nz/>)
* License: Creative Commons Attribution 3.0 Unported (<http://creativecommons.org/licenses/by/3.0/>)
* Source: <https://secure.fanboy.co.nz/fanboy-annoyance.txt>
* “Annoyance” UI and behavior rules (newsletter overlays, social widgets, cookie-style prompts, and similar page clutter).
