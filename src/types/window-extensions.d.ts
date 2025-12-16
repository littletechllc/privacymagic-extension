export {};

declare global {
  class DevicePosture extends EventTarget {
    readonly type: string;
  }

  interface Window {
    DevicePosture?: typeof DevicePosture;
  }
}
