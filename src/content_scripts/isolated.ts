import { getRemoteStyleSheetContentRemote } from '@src/common/messages'
import { handleBackgroundFetchRequests } from './helpers/background-fetch-isolated'

const isolated = () => {
  handleBackgroundFetchRequests(getRemoteStyleSheetContentRemote)
}

isolated()