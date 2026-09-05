import { createBooleanStorageFlag } from '@src/common/boolean-storage-flag'

export const setupVpnStepDone = createBooleanStorageFlag('welcomeVpnStepCompleted')
export const setupHistorySyncStepDone = createBooleanStorageFlag('welcomeHistorySyncStepCompleted')
