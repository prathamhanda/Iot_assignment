export {};

declare module "@/lib/mock-data" {
  export type DeviceType = "Smart Meter" | "Gateway" | "HVAC";
  export type DeviceStatus =
    | "Online"
    | "Offline"
    | "Warning"
    | "online"
    | "offline"
    | "warning";
  export type CommunicationProtocol = "MQTT" | "DLMS" | "DNP3";

  export type Device = {
    id?: string;
    serialNumber: string;
    name: string;
    type: DeviceType;
    location: string;
    macAddress: string;
    firmwareVersion: string;
    protocol: CommunicationProtocol;
    status: DeviceStatus;
  };


}

declare module "@/hooks/useIoTSimulator" {
  import type { Device } from "@/lib/mock-data";

  export type TelemetryPayload = {
    device_id: string;
    timestamp: string;
    temperature: number;
    voltage: number;
    current: number;
    power: number;
  };

  export type Alert = {
    id: string;
    device_id: string;
    timestamp: string;
    metric: "voltage";
    value: number;
    threshold: number;
    severity: "warning";
    message: string;
  };

  export type UseIoTSimulatorReturn = {
    devices: Device[];
    setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
    telemetryByDevice: Record<string, TelemetryPayload[]>;
    alerts: Alert[];
    clearAlerts: () => void;
    onlineCount: number;
    refreshDevices: () => Promise<void>;
  };

  export function useIoTSimulator(): UseIoTSimulatorReturn;
}
