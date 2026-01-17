import { getRemoteStyleSheetContentRemote } from '../common/messages'
import { handleBackgroundFetchRequests } from './background-fetch-isolated'

const isolated = () => {
  handleBackgroundFetchRequests(getRemoteStyleSheetContentRemote)
}

isolated()