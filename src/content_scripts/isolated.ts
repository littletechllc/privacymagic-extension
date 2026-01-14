import { getRemoteStyleSheetContentRemote } from '../common/messages'
import { handleBackgroundFetchRequests } from './background-fetch'

const isolated = () => {
  handleBackgroundFetchRequests(getRemoteStyleSheetContentRemote)
}

isolated()