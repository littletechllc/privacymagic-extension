/** Worker / SharedWorker script URLs including Trusted Types (lib.dom is string | URL only). */
export type WorkerScriptURL = string | URL | TrustedScriptURL

export type WorkerConstructor = {
  prototype: Worker
  new (scriptURL: WorkerScriptURL, options?: WorkerOptions | string): Worker
}

export type SharedWorkerConstructor = {
  prototype: SharedWorker
  new (scriptURL: WorkerScriptURL, options?: WorkerOptions | string): SharedWorker
}
