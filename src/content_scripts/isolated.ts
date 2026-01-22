import { getRemoteStyleSheetContentRemote } from '@src/common/messages'
import { handleBackgroundFetchRequests } from './background-fetch-isolated'

const isolated = () => {
  handleBackgroundFetchRequests(getRemoteStyleSheetContentRemote)
}

isolated()