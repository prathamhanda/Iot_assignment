/**
 * Unified IoT Dashboard - Mock Data
 *
 * Device requirements:
 * - mandatory 10-digit serial number string
 * - name, type, location, macAddress, status
 */

const serial10 = (value) => {
  const str = String(value);
  if (!/^\d{10}$/.test(str)) {
    throw new Error(`Invalid serial number (expected 10 digits): ${str}`);
  }
  return str;
};

// Marker export so this file is an ES module.
// Runtime data is fetched from MongoDB via API routes.
export const __mockDataModule = true;

/**
 * @typedef {"Smart Meter" | "Gateway" | "HVAC"} DeviceType
 * @typedef {"Online" | "Offline" | "Warning" | "online" | "offline" | "warning"} DeviceStatus
 * @typedef {"MQTT" | "DLMS" | "DNP3"} CommunicationProtocol
 *
 * @typedef {Object} Device
 * @property {string=} id
 * @property {string} serialNumber
 * @property {string} name
 * @property {DeviceType} type
 * @property {string} location
 * @property {string} macAddress
 * @property {string} firmwareVersion
 * @property {CommunicationProtocol} protocol
 * @property {DeviceStatus} status
 */

// Note: No hardcoded device arrays in production wiring.
// Seed devices via seed-devices.json / seed.js.
