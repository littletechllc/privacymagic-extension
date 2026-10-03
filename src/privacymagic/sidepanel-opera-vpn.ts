import { operaVpnHelpDoneRemote } from '@src/common/messages-to-background'
import { handleAsync, logError } from '@src/common/util'
import { prepareToCloseSidePanel, tabIdFromQuery } from '@src/privacymagic/sidepanel-helpers'

const tabId = tabIdFromQuery()
prepareToCloseSidePanel(tabId, null)

const doneBtn = document.getElementById('operaVpnHelpDoneBtn')
if (doneBtn instanceof HTMLButtonElement) {
  doneBtn.addEventListener('click', (event: Event) => {
    handleAsync(async () => {
      await operaVpnHelpDoneRemote(tabId)
    }, (error) => {
      logError(error, 'error finishing Opera VPN help', event)
    })
  })
}
