"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Telemetry payload format (DRD Section 3.3)
 * @typedef {Object} TelemetryPayload
 * @property {string} device_id
 * @property {string} timestamp
 * @property {number} temperature
 * @property {number} voltage
 * @property {number} current
 * @property {number} power
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} device_id
 * @property {string} timestamp
 * @property {"voltage"} metric
 * @property {number} value
 * @property {number} threshold
 * @property {"warning"} severity
 * @property {string} message
 */

const HISTORY_LIMIT = 50;
const ALERTS_LIMIT = 100;
const PUBLISH_INTERVAL_MS = 3000;
const VOLTAGE_ALERT_THRESHOLD = 240;

// Global devices and telemetry so all pages stay in sync.
let globalDevices = [];
let globalTelemetryByDevice = {};

/** @type {Set<(devices: any[]) => void>} */
const deviceListeners = new Set();
/** @type {Set<(telemetry: Record<string, TelemetryPayload[]>) => void>} */
const telemetryListeners = new Set();

/** @type {number | null} */
let publisherIntervalId = null;

let devicesLoadPromise = null;

function normalizeStatus(status) {
  return String(status ?? "").toLowerCase();
}

async function loadDevicesFromApi() {
  if (devicesLoadPromise) return devicesLoadPromise;
  devicesLoadPromise = (async () => {
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.devices)) publishDevices(data.devices);
    } finally {
      devicesLoadPromise = null;
    }
  })();
  return devicesLoadPromise;
}

// Simple global alerts store so alerts are shared across hook consumers.
/** @type {Alert[]} */
let globalAlerts = [];
/** @type {Set<(alerts: Alert[]) => void>} */
const alertListeners = new Set();

function publishAlerts(nextAlerts) {
  globalAlerts = nextAlerts;
  for (const listener of alertListeners) listener(globalAlerts);
}

function subscribeAlerts(listener) {
  alertListeners.add(listener);
  listener(globalAlerts);
  return () => alertListeners.delete(listener);
}

let alertsLoadPromise = null;
async function loadAlertsFromApi() {
  if (alertsLoadPromise) return alertsLoadPromise;
  alertsLoadPromise = (async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.alerts)) publishAlerts(data.alerts);
    } finally {
      alertsLoadPromise = null;
    }
  })();
  return alertsLoadPromise;
}

async function persistAlert(alert) {
  try {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    });
  } catch {
    // Best-effort; UI remains responsive even if persistence fails.
  }
}

function publishDevices(nextDevices) {
  globalDevices = nextDevices;
  for (const listener of deviceListeners) listener(globalDevices);
}

function subscribeDevices(listener) {
  deviceListeners.add(listener);
  listener(globalDevices);
  return () => deviceListeners.delete(listener);
}

function publishTelemetry(nextTelemetry) {
  globalTelemetryByDevice = nextTelemetry;
  for (const listener of telemetryListeners) listener(globalTelemetryByDevice);
}

function subscribeTelemetry(listener) {
  telemetryListeners.add(listener);
  listener(globalTelemetryByDevice);
  return () => telemetryListeners.delete(listener);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function jitter(base, magnitude) {
  return base + (Math.random() - 0.5) * 2 * magnitude;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function telemetryForDevice(device) {
  const isHvac = device.type === "HVAC";
  const temperatureBase = isHvac ? 20.5 : 28.0;
  const voltageBase = 230.0;

  const temperature = round(jitter(temperatureBase, 0.6), 2);

  // Humanized voltage: stays around 230V with slight fluctuations.
  // Occasionally spikes to simulate unstable supply.
  const spike = Math.random() < 0.08 ? jitter(248, 8) : 0;
  const voltage = round(clamp(jitter(voltageBase, 4) + spike, 200, 270), 2);

  // Current depends on device type; keep it realistic.
  const currentBase = device.type === "Gateway" ? 0.6 : device.type === "HVAC" ? 8.0 : 4.0;
  const current = round(clamp(jitter(currentBase, currentBase * 0.15), 0.1, 40), 2);

  const power = round(voltage * current, 2);

  return /** @type {TelemetryPayload} */ ({
    device_id: device.serialNumber,
    timestamp: new Date().toISOString(),
    temperature,
    voltage,
    current,
    power,
  });
}

function makeAlert({ device_id, timestamp, voltage }) {
  return /** @type {Alert} */ ({
    id: `${device_id}-${timestamp}`,
    device_id,
    timestamp,
    metric: "voltage",
    value: voltage,
    threshold: VOLTAGE_ALERT_THRESHOLD,
    severity: "warning",
    message: `High voltage detected: ${voltage}V`,
  });
}

function ensurePublisherRunning() {
  if (publisherIntervalId !== null) return;

  publisherIntervalId = window.setInterval(() => {
    const now = new Date().toISOString();
    const nextTelemetry = { ...globalTelemetryByDevice };

    for (const device of globalDevices) {
      if (normalizeStatus(device.status) === "offline") continue;

      const telemetry = telemetryForDevice(device);
      const history = nextTelemetry[device.serialNumber] ?? [];
      nextTelemetry[device.serialNumber] = [telemetry, ...history].slice(0, HISTORY_LIMIT);

      if (telemetry.voltage > VOLTAGE_ALERT_THRESHOLD) {
        const alert = makeAlert({
          device_id: device.serialNumber,
          timestamp: now,
          voltage: telemetry.voltage,
        });
        publishAlerts([alert, ...globalAlerts].slice(0, ALERTS_LIMIT));
        void persistAlert(alert);
      }
    }

    publishTelemetry(nextTelemetry);
  }, PUBLISH_INTERVAL_MS);
}

function maybeStopPublisher() {
  const hasSubscribers =
    deviceListeners.size > 0 || telemetryListeners.size > 0 || alertListeners.size > 0;
  if (!hasSubscribers && publisherIntervalId !== null) {
    window.clearInterval(publisherIntervalId);
    publisherIntervalId = null;
  }
}

/**
 * Simulator hook
 * - Manages device list + live telemetry history
 * - Publishes random telemetry every 3 seconds to online devices
 * - Generates alerts when voltage > 240V and stores them globally
 */
export function useIoTSimulator() {
  const [devices, setDevicesState] = useState(() => globalDevices);
  const [telemetryByDevice, setTelemetryByDeviceState] = useState(
    () => globalTelemetryByDevice
  );
  const [alerts, setAlerts] = useState(() => globalAlerts);

  useEffect(() => {
    ensurePublisherRunning();
    void loadDevicesFromApi();
    void loadAlertsFromApi();
    const unsubDevices = subscribeDevices(setDevicesState);
    const unsubTelemetry = subscribeTelemetry(setTelemetryByDeviceState);
    const unsubAlerts = subscribeAlerts(setAlerts);

    return () => {
      unsubDevices();
      unsubTelemetry();
      unsubAlerts();
      maybeStopPublisher();
    };
  }, []);

  const onlineCount = useMemo(
    () => devices.filter((d) => normalizeStatus(d.status) === "online").length,
    [devices]
  );

  function clearAlerts() {
    publishAlerts([]);
    void fetch("/api/alerts", { method: "DELETE" }).catch(() => {});
  }

  return {
    devices,
    setDevices: (updater) => {
      const next = typeof updater === "function" ? updater(globalDevices) : updater;
      publishDevices(next);
    },
    telemetryByDevice,
    alerts,
    clearAlerts,
    onlineCount,
    refreshDevices: async () => {
      await loadDevicesFromApi();
    },
  };
}
