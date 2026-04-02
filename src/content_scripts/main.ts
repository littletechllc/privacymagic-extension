import { applyPatchesToGlobalObject } from '@src/content_scripts/helpers/patch'
import { prepareWorker } from '@src/content_scripts/helpers/prepare-worker'

if (self instanceof WorkerGlobalScope) {
  prepareWorker(self, self.__PRIVACY_MAGIC_WORKER_URL__)
}
applyPatchesToGlobalObject(self)
