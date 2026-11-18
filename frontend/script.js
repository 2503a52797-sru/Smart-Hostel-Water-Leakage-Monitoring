// ============================================================
// Smart Hostel Water Leakage Monitoring - Dashboard Logic
// ============================================================

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// REPLACE THIS with your actual API Gateway Invoke URL
// Example: "https://abc123xyz.execute-api.ap-south-1.amazonaws.com"
// Do NOT put a trailing slash.
const API_BASE_URL = "YOUR_API_GATEWAY_URL";
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
let totalRequests = 0;
let successfulRequests = 0;
let currentAlerts = [];

// ------------------------------------------------------------
// DOM references
// ------------------------------------------------------------
const el = (id) => document.getElementById(id);

const systemStatusEl = el("systemStatus").querySelector("span");
const cloudStatusEl = el("cloudStatus").querySelector("span");
const lastUpdatedEl = el("lastUpdated");

const cardTotal = el("cardTotal");
const cardActive = el("cardActive");
const cardResolved = el("cardResolved");
const cardEmergency = el("cardEmergency");
const cardNotifications = el("cardNotifications");

const indicator = el("leakIndicator");
const indicatorLabel = el("indicatorLabel");

const hostelBlock = el("hostelBlock");
const roomNumber = el("roomNumber");

const btnSimulate = el("btnSimulate");
const btnEmergency = el("btnEmergency");
const btnResolve = el("btnResolve");
const actionMessage = el("actionMessage");

const metricTotalReq = el("metricTotalReq");
const metricSuccessReq = el("metricSuccessReq");
const metricActive = el("metricActive");
const metricResolved = el("metricResolved");
const metricEmergency = el("metricEmergency");
const metricAvgResp = el("metricAvgResp");

const filterLocation = el("filterLocation");
const filterStatus = el("filterStatus");
const filterSeverity = el("filterSeverity");
const filterEventType = el("filterEventType");
const btnApplyFilters = el("btnApplyFilters");
const btnRefresh = el("btnRefresh");

const alertTableBody = el("alertTableBody");

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------
function isConfigured() {
  return API_BASE_URL && API_BASE_URL !== "YOUR_API_GATEWAY_URL";
}

function showMessage(text, type) {
  actionMessage.textContent = text;
  actionMessage.className = "action-message " + (type || "");
  setTimeout(() => {
    actionMessage.textContent = "";
    actionMessage.className = "action-message";
  }, 5000);
}

function setButtonsDisabled(state) {
  btnSimulate.disabled = state;
  btnEmergency.disabled = state;
  btnResolve.disabled = state;
}

function formatTimestamp(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

function updateLastUpdated() {
  lastUpdatedEl.textContent = new Date().toLocaleTimeString();
}

async function apiRequest(path, options = {}) {
  totalRequests++;
  metricTotalReq.textContent = totalRequests;

  if (!isConfigured()) {
    cloudStatusEl.textContent = "NOT CONFIGURED";
    cloudStatusEl.className = "fail";
    throw new Error("API_BASE_URL is not configured in script.js");
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `Request failed with status ${res.status}`);
    }

    successfulRequests++;
    metricSuccessReq.textContent = successfulRequests;
    cloudStatusEl.textContent = "CONNECTED";
    cloudStatusEl.className = "ok";
    systemStatusEl.textContent = "ONLINE";
    systemStatusEl.className = "ok";

    return await res.json();
  } catch (err) {
    cloudStatusEl.textContent = "DISCONNECTED";
    cloudStatusEl.className = "fail";
    systemStatusEl.textContent = "OFFLINE";
    systemStatusEl.className = "fail";
    throw err;
  }
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------
function renderIndicator() {
  const hasActiveLeak = currentAlerts.some(a => a.status === "ACTIVE");
  if (hasActiveLeak) {
    indicator.classList.add("leak");
    indicatorLabel.textContent = "🚨 WATER LEAK DETECTED";
  } else {
    indicator.classList.remove("leak");
    indicatorLabel.textContent = "● SAFE";
  }
}

function renderTable(alerts) {
  if (!alerts.length) {
    alertTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">No alerts found.</td></tr>`;
    return;
  }

  alertTableBody.innerHTML = alerts.map(a => `
    <tr>
      <td>${a.alertId}</td>
      <td>${a.location}</td>
      <td>${a.room}</td>
      <td>${a.eventType}</td>
      <td><span class="badge badge-${(a.severity || "").toLowerCase()}">${a.severity}</span></td>
      <td>${formatTimestamp(a.createdAt)}</td>
      <td><span class="badge badge-${(a.status || "").toLowerCase()}">${a.status}</span></td>
    </tr>
  `).join("");
}

function renderCardsAndMetrics(stats) {
  cardTotal.textContent = stats.totalAlerts;
  cardActive.textContent = stats.activeLeaks;
  cardResolved.textContent = stats.resolvedLeaks;
  cardEmergency.textContent = stats.emergencyAlerts;
  cardNotifications.textContent = stats.totalAlerts; // one notification per alert

  metricActive.textContent = stats.activeLeaks;
  metricResolved.textContent = stats.resolvedLeaks;
  metricEmergency.textContent = stats.emergencyAlerts;
  metricAvgResp.textContent = `${stats.averageResponseTime} ms`;
}

// ------------------------------------------------------------
// Data loading
// ------------------------------------------------------------
async function loadAlerts() {
  try {
    const params = new URLSearchParams();
    if (filterLocation.value) params.append("location", filterLocation.value);
    if (filterStatus.value) params.append("status", filterStatus.value);
    if (filterSeverity.value) params.append("severity", filterSeverity.value);

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await apiRequest(`/alerts${query}`);

    let alerts = data.alerts || [];
    if (filterEventType.value) {
      alerts = alerts.filter(a => a.eventType === filterEventType.value);
    }

    currentAlerts = alerts;
    renderTable(alerts);
    renderIndicator();
    updateLastUpdated();
  } catch (err) {
    alertTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">Unable to connect to cloud backend. Please try again.</td></tr>`;
  }
}

async function loadStats() {
  try {
    const data = await apiRequest("/stats");
    renderCardsAndMetrics(data);
  } catch (err) {
    // silently fail - error already shown via table load
  }
}

async function refreshDashboard() {
  await Promise.all([loadAlerts(), loadStats()]);
}

// ------------------------------------------------------------
// Actions
// ------------------------------------------------------------
async function simulateLeak() {
  setButtonsDisabled(true);
  try {
    if (!roomNumber.value.trim()) {
      showMessage("Please enter a room number.", "error");
      return;
    }
    const payload = {
      location: hostelBlock.value,
      room: roomNumber.value.trim(),
      eventType: "WATER_LEAK",
      severity: "HIGH"
    };
    const data = await apiRequest("/alerts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showMessage(`✅ ${data.message} (${data.alertId})`, "success");
    await refreshDashboard();
  } catch (err) {
    showMessage("Unable to connect to cloud backend. Please try again.", "error");
  } finally {
    setButtonsDisabled(false);
  }
}

async function triggerEmergency() {
  setButtonsDisabled(true);
  try {
    if (!roomNumber.value.trim()) {
      showMessage("Please enter a room number.", "error");
      return;
    }
    const payload = {
      location: hostelBlock.value,
      room: roomNumber.value.trim(),
      eventType: "MANUAL_EMERGENCY",
      severity: "HIGH"
    };
    const data = await apiRequest("/alerts/emergency", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showMessage(`🚨 ${data.message}`, "success");
    await refreshDashboard();
  } catch (err) {
    showMessage("Unable to connect to cloud backend. Please try again.", "error");
  } finally {
    setButtonsDisabled(false);
  }
}

async function resolveLatestActive() {
  setButtonsDisabled(true);
  try {
    const activeAlert = currentAlerts.find(a => a.status === "ACTIVE");
    if (!activeAlert) {
      showMessage("No active alert to resolve.", "error");
      return;
    }
    const data = await apiRequest(`/alerts/${activeAlert.alertId}/resolve`, {
      method: "PATCH"
    });
    showMessage(`✓ Alert ${data.alertId} marked as RESOLVED.`, "success");
    await refreshDashboard();
  } catch (err) {
    showMessage("Unable to resolve alert. Please try again.", "error");
  } finally {
    setButtonsDisabled(false);
  }
}

// ------------------------------------------------------------
// Event listeners
// ------------------------------------------------------------
btnSimulate.addEventListener("click", simulateLeak);
btnEmergency.addEventListener("click", triggerEmergency);
btnResolve.addEventListener("click", resolveLatestActive);
btnApplyFilters.addEventListener("click", loadAlerts);
btnRefresh.addEventListener("click", refreshDashboard);

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
if (!isConfigured()) {
  showMessage("⚠ API_BASE_URL is not configured. Edit script.js and set your API Gateway URL.", "error");
  systemStatusEl.textContent = "NOT CONFIGURED";
  cloudStatusEl.textContent = "NOT CONFIGURED";
} else {
  refreshDashboard();
  // Auto-refresh every 15 seconds
  setInterval(refreshDashboard, 15000);
}
