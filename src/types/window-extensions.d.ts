export {};

declare global {
  class BatteryManager extends EventTarget {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
  }
  class DevicePosture extends EventTarget {
    readonly type: string;
  }

  interface Window {
    BatteryManager?: typeof BatteryManager;
    DevicePosture?: typeof DevicePosture;
  }
}
