let STATE = {
  devices: [],
  movements: [],
  categories: [],
  categoryUnits: {},
  locations: [],
  usageLocations: [],
  currentUser: null
};

let selectedCodes = new Set();
let html5QrCode = null;

// Gán dữ liệu an toàn cho thẻ input và select
function setElementValueSafe(id, val, isSelect = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isSelect && el.tagName === "SELECT") {
    if (val && !Array.from(el.options).some(o => o.value === val)) {
      el.add(new Option(val, val, true, true));
    }
    el.value = val || (el.options[0] ? el.options[0].value : "");
  } else {
    el.value = val || "";
  }
}

// Bật Modal chắc chắn hiển thị (vượt qua mọi xung đột CSS)
function showModalById(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("active");
  m.style.setProperty("display", "flex", "important");
}

// Đóng Modal an toàn
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("active");
  m.style.setProperty("display", "none", "important");
}

// BỘ ĐIỀU PHỐI SỰ KIỆN CLICK TOÀN CỤC (LOẠI BỎ 100% LỖI CÚ PHÁP CHUỖI)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;

  const act = btn.getAttribute("data-act");
  const val = btn.getAttribute("data-val") || "";

  if (act === "entity-inventory") {
    openEntityInventory(btn.getAttribute("data-type") || "", val);
  } else if (act === "entity-inventory-export") {
    exportEntityInventory();
  } else if (act === "entity-inventory-close") {
    closeEntityInventory();
  } else if (act === "device-history") {
    openDeviceHistory(val);
  } else if (act === "device-history-close") {
    const panel = document.getElementById("deviceHistoryPanel");
    if (panel) { panel.classList.add("hidden"); panel.innerHTML = ""; }
  } else if (act === "edit-dev") {
    openDeviceModal(val);
  } else if (act === "quick-mov") {
    openMovementModal(val);
  } else if (act === "del-dev") {
    deleteDeviceByCode(val);
  } else if (act === "rename-loc") {
    renameLocation(val);
  } else if (act === "del-loc") {
    deleteLocation(val);
  } else if (act === "rename-cat") {
    renameCategory(val);
  } else if (act === "del-cat") {
    deleteCategory(val);
  } else if (act === "unit-cat") {
    editCategoryUnit(val);
  } else if (act === "dashboard-location") {
    openDashboardLocation(val);
  } else if (act === "dashboard-usage-location") {
    openDashboardUsageLocation(val);
  } else if (act === "dashboard-usage-close") {
    const detail = document.getElementById("dashboardUsageDetail");
    if (detail) { detail.classList.add("hidden"); detail.innerHTML = ""; }
  } else if (act === "edit-usage-loc") {
    openUsageLocationModal(val);
  } else if (act === "del-usage-loc") {
    deleteUsageLocation(val);
  } else if (act === "cancel-movement") {
    cancelMovement(val);
  } else if (act === "delete-movement") {
    deleteMovementHistory(val);
  } else if (act === "dashboard-location-close") {
    const detail = document.getElementById("dashboardLocationDetail");
    if (detail) { detail.classList.add("hidden"); detail.innerHTML = ""; }
  }
});

// LẮNG NGHE SỰ KIỆN CHỌN CHECKBOX THIẾT BỊ
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "entityInventorySearch") renderEntityInventoryRows();
  if (e.target && e.target.id === "stocktakeSearch") renderStocktake();
  if (e.target && e.target.matches("[data-stocktake-code]")) {
    const code=e.target.getAttribute("data-stocktake-code");
    if (e.target.hasAttribute("data-stocktake-qty")) setStocktakeCount(code, e.target.value, false);
    if (e.target.hasAttribute("data-stocktake-note")) setStocktakeNote(code, e.target.value, false);
    updateStocktakeSummary();
  }
});
document.addEventListener("change", (e) => { if (e.target && e.target.matches("[data-stocktake-qty]")) renderStocktake(); });

document.addEventListener("change", (e) => {
  const chk = e.target.closest("input.dev-check");
  if (chk) toggleSelectDevice(chk.value, chk.checked);
  const bulkChk = e.target.closest("input.bulk-pick-check");
  if (bulkChk) {
    if (bulkChk.checked) selectedCodes.add(bulkChk.value); else selectedCodes.delete(bulkChk.value);
    updateBulkPickerCount(); updateFloatingBar();
  }
});

// Sidebar: trạng thái chỉ lưu trên trình duyệt đang sử dụng.
function applySidebarState(collapsed) {
  const app = document.getElementById("app");
  const btn = document.getElementById("sidebarToggle");
  if (!app || !btn) return;
  app.classList.toggle("sidebar-collapsed", !!collapsed);
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  btn.setAttribute("aria-expanded", String(!collapsed));
  btn.setAttribute("aria-label", collapsed ? "Mở rộng menu" : "Thu gọn menu");
  btn.setAttribute("title", collapsed ? "Mở rộng menu" : "Thu gọn menu");
  const label = btn.querySelector(".toggle-label");
  const glyph = btn.querySelector(".toggle-glyph");
  if (label) label.textContent = isMobile ? (collapsed ? "Mở menu" : "Đóng menu") : (collapsed ? "Mở rộng" : "Thu gọn");
  if (glyph) glyph.textContent = isMobile ? (collapsed ? "☰" : "×") : (collapsed ? "›" : "‹");
}

function toggleSidebar() {
  const app = document.getElementById("app");
  if (!app) return;
  const collapsed = !app.classList.contains("sidebar-collapsed");
  applySidebarState(collapsed);
  try { localStorage.setItem("kho_sidebar_collapsed", collapsed ? "1" : "0"); } catch (_) {}
}

function initSidebar() {
  let collapsed = window.matchMedia("(max-width: 900px)").matches;
  try {
    const saved = localStorage.getItem("kho_sidebar_collapsed");
    if (saved === "1") collapsed = true;
    else if (saved === "0") collapsed = false;
  } catch (_) {}
  applySidebarState(collapsed);
  window.addEventListener("resize", () => {
    const app = document.getElementById("app");
    if (app) applySidebarState(app.classList.contains("sidebar-collapsed"));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.history.state || !window.history.state.khoView) {
    window.history.replaceState({ khoView: "dashboard", khoViewIndex: 0 }, "", `${window.location.pathname}${window.location.search}#dashboard`);
  }
  window.__khoViewMaxIndex = Number.isInteger(window.history.state?.khoViewIndex) ? window.history.state.khoViewIndex : 0;
  window.addEventListener("popstate", event => {
    const viewId = event.state?.khoView;
    if (viewId && document.getElementById(viewId)) {
      showView(viewId, { history: false });
      updateViewHistoryButtons();
    }
  });
  initSidebar();
  const token = localStorage.getItem("kho_token");
  const cachedUser = localStorage.getItem("kho_user");

  if (token && cachedUser) {
    try {
      STATE.currentUser = JSON.parse(cachedUser);
      showApp();
      loadState();
    } catch (e) {
      handleLogout();
    }
  } else {
    document.getElementById("login")?.classList.remove("hidden");
    document.getElementById("app")?.classList.add("hidden");
  }
});

const VIEW_TITLES = {
  dashboard: "Tổng quan",
  devices: "Danh sách tài sản & vật tư",
  locations: "Kho lưu trữ",
  usageLocations: "Nơi sử dụng",
  categories: "Danh mục thiết bị",
  movements: "Lịch sử điều chuyển & sự cố",
  disposition: "Theo dõi hỏng / sửa chữa / thanh lý",
  reports: "Báo cáo & Nhập Excel",
  users: "Quản trị người dùng",
  guide: "Hướng dẫn nghiệp vụ"
};

function navigateViewHistory(direction) {
  if (direction < 0) window.history.back();
  else window.history.forward();
}

function updateViewHistoryButtons() {
  const back = document.getElementById("viewBackBtn");
  const forward = document.getElementById("viewForwardBtn");
  const state = window.history.state || {};
  if (back) back.disabled = !(Number.isInteger(state.khoViewIndex) && state.khoViewIndex > 0);
  if (forward) forward.disabled = !(Number.isInteger(state.khoViewIndex) && state.khoViewIndex < (window.__khoViewMaxIndex || state.khoViewIndex));
}

function showView(viewId, options = {}) {
  if (!document.getElementById(viewId)) return;
  if (options.history !== false) {
    const currentState = window.history.state || {};
    let index = Number.isInteger(currentState.khoViewIndex) ? currentState.khoViewIndex + 1 : 1;
    window.__khoViewMaxIndex = index;
    window.history.pushState({ khoView: viewId, khoViewIndex: index }, "", `#${viewId}`);
  }
  document.querySelectorAll(".view").forEach(v => {
    v.classList.add("hidden");
    v.style.display = "none";
  });
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.remove("hidden");
    target.style.display = "block";
  }

  const btn = Array.from(document.querySelectorAll(".nav-btn")).find(b => b.getAttribute("onclick")?.includes(viewId));
  if (btn) btn.classList.add("active");

  const title = VIEW_TITLES[viewId] || "Kho";
  const titleEl = document.getElementById("pageTitle");
  const labelEl = document.getElementById("currentViewLabel");
  if (titleEl) titleEl.innerText = title;
  if (labelEl) labelEl.innerText = title;
  updateViewHistoryButtons();

  if (viewId === "users") loadUsers();
  if (viewId === "categories") renderCategories();
  if (viewId === "locations") renderLocations();
  if (viewId === "usageLocations") renderUsageLocations();
  if (viewId === "reports") renderCustodyReport();
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errBox = document.getElementById("loginError");
  errBox.classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Đăng nhập thất bại");

    localStorage.setItem("kho_token", data.token);
    localStorage.setItem("kho_user", JSON.stringify(data.user));
    STATE.currentUser = data.user;

    showApp();
    loadState();
  } catch (err) {
    errBox.innerText = err.message;
    errBox.classList.remove("hidden");
  }
}

function showApp() {
  document.getElementById("login")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
  const nameEl = document.getElementById("currentUserName");
  if (nameEl) nameEl.innerText = STATE.currentUser.displayName || STATE.currentUser.username;
  const badgeEl = document.getElementById("userRoleBadge");
  if (badgeEl) badgeEl.innerText = STATE.currentUser.role === "admin" ? "Quản trị viên" : "Người xem (Viewer)";

  const isAdmin = STATE.currentUser.role === "admin";
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = isAdmin ? "" : "none";
  });
}

function handleLogout() {
  localStorage.removeItem("kho_token");
  localStorage.removeItem("kho_user");
  location.reload();
}

async function loadState() {
  const token = localStorage.getItem("kho_token");
  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.innerText = "Đang tải...";

  try {
    const res = await fetch(`${API_BASE_URL}/api/state`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) return handleLogout();
    const data = await res.json();

    STATE.devices = data.devices || [];
    STATE.movements = data.movements || [];
    STATE.categories = data.categories || [];
    STATE.categoryUnits = data.categoryUnits || {};
    STATE.locations = data.locations || [
      "Kho kỹ thuật - Tầng 1",
      "Kho thiết bị dự phòng",
      "Kho thanh lý / Chờ xử lý",
      "Tủ Rack Server - Trung tâm dữ liệu"
    ];
    STATE.usageLocations = Array.isArray(data.usageLocations) ? data.usageLocations.map(l => typeof l === "string" ? { id: l, name: l, department: "", manager: "", address: "" } : l) : [];
    // Giữ hiển thị các địa điểm của tài sản cũ đang sử dụng để không làm mất khả năng thu hồi; admin có thể chuẩn hóa vào danh mục.
    const knownUsageNames = new Set(STATE.usageLocations.map(l => String(l.name || l).trim().toLowerCase()));
    for (const d of STATE.devices) {
      const oldPlace = d.status === "Đang sử dụng" ? String(d.usageLocation || d.location || "").trim() : "";
      if (oldPlace && !knownUsageNames.has(oldPlace.toLowerCase())) {
        STATE.usageLocations.push({ id: "", name: oldPlace, department: "", manager: "", address: "", legacy: true });
        knownUsageNames.add(oldPlace.toLowerCase());
      }
      if (d.trackingMode === "quantity") for (const oldPlaceQty of Object.keys(d.usageByLocation || {})) {
        if (Number(d.usageByLocation[oldPlaceQty] || 0) > 0 && !knownUsageNames.has(oldPlaceQty.toLowerCase())) {
          STATE.usageLocations.push({ id: "", name: oldPlaceQty, department: "", manager: "", address: "", legacy: true });
          knownUsageNames.add(oldPlaceQty.toLowerCase());
        }
      }
    }

    renderDashboard();
    populateSelects();
    renderDevices();
    renderMovements();
    renderDisposition();
    renderCategories();
    renderLocations();
    renderUsageLocations();
    renderCustodyReport();
  renderStocktake();

    if (statusEl) statusEl.innerText = "Đã đồng bộ";
  } catch (err) {
    if (statusEl) statusEl.innerText = "Lỗi kết nối";
  }
}

function sumQtyMap(map) { return Object.values(map || {}).reduce((sum, n) => sum + (Number(n) || 0), 0); }
function deviceStockQuantity(d) { return d.trackingMode === "quantity" ? sumQtyMap(d.stockByLocation) : (d.status === "Trong kho" ? 1 : 0); }
function deviceUsageQuantity(d) { return d.trackingMode === "quantity" ? sumQtyMap(d.usageByLocation) : (d.status === "Đang sử dụng" ? 1 : 0); }
function deviceDamagedQuantity(d) { return d.trackingMode === "quantity" ? sumQtyMap(d.damagedByLocation) + sumQtyMap(d.usageDamagedByLocation) + sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation) : (/Hỏng|Bảo hành|Đang sửa chữa/i.test(d.status || "") ? 1 : 0); }

// Phân trang dùng chung: mặc định 10 dòng, cho phép 10/25/50 dòng mỗi trang.
const TABLE_PAGE_SIZE = 10;
const tablePageState = Object.create(null);

function applyTablePagination(tbodyId, key, defaultPageSize = TABLE_PAGE_SIZE) {
  const tbody = document.getElementById(tbodyId);
  const table = tbody?.closest("table");
  if (!tbody || !table) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const dataRows = rows.filter(row => !row.querySelector(".empty-state") && !row.querySelector("[data-empty-row]") && !row.querySelector("td[colspan]"));
  const host = table.closest(".table-card") || table.parentElement;
  if (!host) return;
  let pager = host.querySelector(`.table-pagination[data-page-key="${key}"]`);
  if (!pager) {
    pager = document.createElement("div");
    pager.className = "table-pagination";
    pager.dataset.pageKey = key;
    host.appendChild(pager);
  }
  if (!tablePageState[key]) tablePageState[key] = { page: 1, size: defaultPageSize };
  const state = tablePageState[key];
  const size = Math.max(1, Number(state.size) || defaultPageSize);
  const total = dataRows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  state.page = Math.min(Math.max(1, Number(state.page) || 1), pages);

  if (total <= size) {
    dataRows.forEach(row => row.style.display = "");
    rows.filter(row => !dataRows.includes(row)).forEach(row => row.style.display = "");
    pager.innerHTML = `<span class="pagination-summary">${total ? `Hiển thị ${total} dòng` : "Không có dữ liệu"}</span>`;
    pager.classList.toggle("pagination-empty", total === 0);
    return;
  }
  const start = (state.page - 1) * size;
  const end = Math.min(start + size, total);
  dataRows.forEach((row, index) => row.style.display = index >= start && index < end ? "" : "none");
  rows.filter(row => !dataRows.includes(row)).forEach(row => row.style.display = "");
  pager.classList.remove("pagination-empty");
  pager.innerHTML = `
    <span class="pagination-summary">Dòng ${start + 1}–${end} / ${total}</span>
    <label class="pagination-size">Mỗi trang
      <select aria-label="Số dòng mỗi trang" data-page-size="${key}">
        ${[10,25,50].map(n => `<option value="${n}" ${size === n ? "selected" : ""}>${n}</option>`).join("")}
      </select>
    </label>
    <div class="pagination-buttons">
      <button type="button" class="secondary" data-page-action="first" data-page-key="${key}" ${state.page <= 1 ? "disabled" : ""} aria-label="Trang đầu">«</button>
      <button type="button" class="secondary" data-page-action="prev" data-page-key="${key}" ${state.page <= 1 ? "disabled" : ""}>Trước</button>
      <span class="pagination-current">Trang ${state.page} / ${pages}</span>
      <button type="button" class="secondary" data-page-action="next" data-page-key="${key}" data-pages="${pages}" ${state.page >= pages ? "disabled" : ""}>Sau</button>
      <button type="button" class="secondary" data-page-action="last" data-page-key="${key}" data-pages="${pages}" ${state.page >= pages ? "disabled" : ""} aria-label="Trang cuối">»</button>
    </div>`;
  if (!pager.dataset.bound) {
    pager.dataset.bound = "1";
    pager.addEventListener("click", event => {
      const button = event.target.closest("[data-page-action]");
      if (!button || button.disabled) return;
      const k = button.dataset.pageKey, s = tablePageState[k];
      if (!s) return;
      const max = Number(button.dataset.pages) || Math.max(1, Math.ceil((document.getElementById(tbodyId)?.querySelectorAll("tr")?.length || 0) / s.size));
      if (button.dataset.pageAction === "first") s.page = 1;
      if (button.dataset.pageAction === "prev") s.page = Math.max(1, s.page - 1);
      if (button.dataset.pageAction === "next") s.page = Math.min(max, s.page + 1);
      if (button.dataset.pageAction === "last") s.page = max;
      applyTablePagination(tbodyId, k, defaultPageSize);
    });
    pager.addEventListener("change", event => {
      const select = event.target.closest("[data-page-size]");
      if (!select) return;
      const k = select.dataset.pageSize;
      if (!tablePageState[k]) tablePageState[k] = { page: 1, size: defaultPageSize };
      tablePageState[k].size = Number(select.value) || defaultPageSize;
      tablePageState[k].page = 1;
      applyTablePagination(tbodyId, k, defaultPageSize);
    });
  }
}


function renderDashboardAlerts() {
  const grid = document.getElementById("dashboardAlertsGrid");
  if (!grid) return;
  const low = STATE.devices.filter(d => d.trackingMode === "quantity" && deviceStockQuantity(d) > 0 && deviceStockQuantity(d) <= 2);
  const noGood = STATE.devices.filter(d => d.trackingMode === "quantity" && deviceStockQuantity(d) <= 0 &&
    (deviceUsageQuantity(d) + deviceDamagedQuantity(d) + sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation) > 0));
  const damaged = STATE.devices.filter(d => d.trackingMode === "quantity"
    ? sumQtyMap(d.damagedByLocation) + sumQtyMap(d.usageDamagedByLocation) > 0
    : /hỏng|bảo hành/i.test(d.status || ""));
  const repair = STATE.devices.filter(d => d.trackingMode === "quantity"
    ? sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation) > 0
    : /đang sửa chữa/i.test(d.status || ""));
  const cards = [
    {key:"low", icon:"📉", title:"Vật tư sắp hết", detail:"Tồn tốt từ 1–2 đơn vị", count:low.length, tone:"warning"},
    {key:"empty", icon:"📦", title:"Hết tồn tốt", detail:"Không còn hàng tốt để cấp phát", count:noGood.length, tone:"danger"},
    {key:"damaged", icon:"⚠️", title:"Hỏng / bảo hành", detail:"Cần xử lý hoặc theo dõi", count:damaged.length, tone:"danger"},
    {key:"repair", icon:"🛠️", title:"Đang sửa chữa", detail:"Đang sửa hoặc chờ bảo hành", count:repair.length, tone:"info"}
  ];
  grid.innerHTML = cards.map(c => `<button type="button" class="dashboard-alert-card alert-${c.tone}" data-dashboard-alert="${c.key}">
    <span class="dashboard-alert-icon" aria-hidden="true">${c.icon}</span>
    <span class="dashboard-alert-copy"><strong>${c.title}</strong><small>${c.detail}</small></span>
    <span class="dashboard-alert-count">${Number(c.count).toLocaleString("vi-VN")}</span>
  </button>`).join("");
}

function openDashboardAlert(kind) {
  if (kind === "low" || kind === "empty") {
    showView("devices");
    const status = document.getElementById("filterDeviceStatus");
    if (status) status.value = kind === "low" ? "lowStock" : "noGoodStock";
    ["deviceSearch","filterCategory","filterLocation"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
    renderDevices();
    return;
  }
  showView("disposition");
  const type = document.getElementById("dispositionTypeFilter");
  if (type) type.value = kind === "damaged" ? "Hỏng / Bảo hành" : "Đang sửa chữa";
  ["dispositionSearch","dispositionLocationFilter"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  renderDisposition();
}

function renderDashboard() {
  const total = document.getElementById("statTotalDevices");
  const qtyOf = d => Number.isFinite(Number(d.quantity)) && d.quantity !== "" ? Number(d.quantity) : 1;
  if (total) total.innerText = STATE.devices.reduce((sum, d) => sum + (d.status === "Thanh lý" ? 0 : qtyOf(d)), 0).toLocaleString("vi-VN");
  const inStock = document.getElementById("statInStock");
  if (inStock) inStock.innerText = STATE.devices.reduce((sum, d) => sum + deviceStockQuantity(d), 0).toLocaleString("vi-VN");
  const inUse = document.getElementById("statInUse");
  if (inUse) inUse.innerText = STATE.devices.reduce((sum, d) => sum + deviceUsageQuantity(d), 0).toLocaleString("vi-VN");
  const faulty = document.getElementById("statFaulty");
  if (faulty) faulty.innerText = STATE.devices.reduce((sum, d) => sum + deviceDamagedQuantity(d), 0).toLocaleString("vi-VN");
  renderDashboardLocations();
  renderDashboardUsageLocations();
  renderDashboardAlerts();
  renderDashboardRecentMovements();
}

function renderDashboardRecentMovements() {
  const body = document.getElementById("dashboardRecentMovements");
  if (!body) return;
  const rows = (STATE.movements || []).slice(0, 3);
  body.innerHTML = rows.map(m => {
    const cancelled = Boolean(m.cancelled || m.cancelledAt);
    const from = m.fromLocation || m.fromUsageLocation || "—";
    const to = m.toLocation || m.usageLocation || "—";
    return `<tr>
      <td>${m.createdAt ? escapeHtml(new Date(m.createdAt).toLocaleString("vi-VN")) : "—"}</td>
      <td><strong>${escapeHtml(m.deviceCode || "—")}</strong></td>
      <td>${escapeHtml(m.type || "Giao dịch")}</td>
      <td>${escapeHtml(from)} <span class="muted">→</span> ${escapeHtml(to)}</td>
      <td>${escapeHtml(m.createdBy || "—")}</td>
      <td><span class="badge ${cancelled ? "badge-danger" : "badge-primary"}">${cancelled ? "Đã hủy" : "Hoàn tất"}</span></td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="muted empty-state">Chưa có giao dịch nào. Khi tạo phiếu nhập, xuất hoặc sự cố, lịch sử sẽ hiển thị tại đây.</td></tr>`;
}

function getDeviceQuantityAtLocation(device, location) {
  const qty = Number(device.quantity);
  if (device.trackingMode === "quantity") {
    return Math.max(0, Number((device.stockByLocation || {})[location] || 0) + Number((device.damagedByLocation || {})[location] || 0) + Number((device.usageByLocation || {})[location] || 0) + Number((device.usageDamagedByLocation || {})[location] || 0) + Number((device.usageRepairByLocation || {})[location] || 0) + Number((device.disposedByLocation || {})[location] || 0));
  }
  const same = String(device.location || "").trim().toLowerCase() === String(location || "").trim().toLowerCase();
  return same ? (Number.isFinite(qty) && qty > 0 ? qty : 1) : 0;
}

function getWarehouseQuantityAtLocation(device, location) {
  if (device.trackingMode === "quantity") return Math.max(0, Number((device.stockByLocation || {})[location] || 0) + Number((device.damagedByLocation || {})[location] || 0) + Number((device.repairByLocation || {})[location] || 0) + Number((device.disposedByLocation || {})[location] || 0));
  if (device.status === "Đang sử dụng") return 0;
  return String(device.location || "").trim().toLowerCase() === String(location || "").trim().toLowerCase() ? 1 : 0;
}
function displayDeviceStatus(d) {
  if (d.trackingMode !== "quantity") return d.status || "Chưa xác định";
  const stock = sumQtyMap(d.stockByLocation), use = sumQtyMap(d.usageByLocation), damaged = sumQtyMap(d.damagedByLocation) + sumQtyMap(d.usageDamagedByLocation), repair = sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation);
  const labels = [];
  if (stock > 0) labels.push(`Tốt trong kho: ${stock.toLocaleString("vi-VN")}`);
  if (use > 0) labels.push(`Đang sử dụng: ${use.toLocaleString("vi-VN")}`);
  if (damaged > 0) labels.push(`Hỏng/chờ xử lý: ${damaged.toLocaleString("vi-VN")}`);
  if (repair > 0) labels.push(`Đang sửa: ${repair.toLocaleString("vi-VN")}`);
  const disposed = sumQtyMap(d.disposedByLocation); if (disposed > 0) labels.push(`Thanh lý: ${disposed.toLocaleString("vi-VN")}`);
  return labels.join(" / ") || "Hết tồn";
}

function renderDashboardLocations() {
  const container = document.getElementById("dashboardLocations");
  if (!container) return;
  const usageNames = (STATE.usageLocations || []).map(l => l.name || l);
  const locations = [...new Set([...(STATE.locations || []).filter(loc => !usageNames.includes(loc) || STATE.devices.some(d => getWarehouseQuantityAtLocation(d, loc) > 0)), ...STATE.devices.map(d => d.location).filter(loc => loc && !usageNames.includes(loc))])];
  if (!locations.length) {
    container.innerHTML = '<div class="muted">Chưa có vị trí/kho. Hãy thêm vị trí trong mục Danh bạ Vị trí & Kho.</div>';
    return;
  }
  container.style.gridTemplateColumns = "repeat(auto-fit, minmax(210px, 1fr))";
  container.innerHTML = locations.map(loc => {
    const records = STATE.devices.filter(d => getWarehouseQuantityAtLocation(d, loc) > 0);
    const qty = records.reduce((sum, d) => sum + getWarehouseQuantityAtLocation(d, loc), 0);
    const damaged = records.reduce((sum, d) => sum + (d.trackingMode === "quantity" ? Number((d.damagedByLocation || {})[loc] || 0) + Number((d.repairByLocation || {})[loc] || 0) : (/Hỏng|Bảo hành|Đang sửa chữa|Thanh lý/i.test(d.status || "") ? getWarehouseQuantityAtLocation(d, loc) : 0)), 0);
    return `<button type="button" data-act="dashboard-location" data-val="${escapeAttr(loc)}" class="card" style="text-align:left; cursor:pointer; border:1px solid var(--border-color, #dbe2ea); padding:14px; background:var(--card-bg, #fff); color:inherit; min-height:120px;">
      <div style="font-size:22px; margin-bottom:8px;">📦</div>
      <div style="font-weight:700; line-height:1.35;">${escapeHtml(loc)}</div>
      <div style="font-size:22px; font-weight:800; margin-top:8px;">${qty.toLocaleString("vi-VN")}</div>
      <div class="muted" style="font-size:12px;">${records.length} mã tài sản/vật tư${damaged ? ` · ${damaged.toLocaleString("vi-VN")} hỏng/thanh lý` : ""}</div>
      <div style="font-size:12px; color:#2563eb; margin-top:8px;">Xem danh sách →</div>
    </button>`;
  }).join("");
}

function getDeviceUsageAtLocation(device, location) {
  if (device.trackingMode === "quantity") return Math.max(0, Number((device.usageByLocation || {})[location] || 0) + Number((device.usageDamagedByLocation || {})[location] || 0) + Number((device.usageRepairByLocation || {})[location] || 0));
  return device.status === "Đang sử dụng" && String(device.usageLocation || device.location || "").trim().toLowerCase() === String(location || "").trim().toLowerCase() ? 1 : 0;
}
function renderDashboardUsageLocations() {
  const container = document.getElementById("dashboardUsageLocations"); if (!container) return;
  const places = (STATE.usageLocations || []).map(l => l.name || l);
  if (!places.length) { container.innerHTML = '<div class="muted">Chưa có nơi sử dụng. Hãy khai báo cơ sở, tòa nhà, phòng hoặc công trình.</div>'; return; }
  container.style.gridTemplateColumns = "repeat(auto-fit, minmax(210px, 1fr))";
  container.innerHTML = places.map(loc => {
    const records = STATE.devices.filter(d => getDeviceUsageAtLocation(d, loc) > 0);
    const qty = records.reduce((sum, d) => sum + getDeviceUsageAtLocation(d, loc), 0);
    return `<button type="button" data-act="dashboard-usage-location" data-val="${escapeAttr(loc)}" class="card" style="text-align:left; cursor:pointer; border:1px solid var(--border-color, #dbe2ea); padding:14px; background:var(--card-bg, #fff); color:inherit; min-height:120px;"><div style="font-size:22px; margin-bottom:8px;">📍</div><div style="font-weight:700; line-height:1.35;">${escapeHtml(loc)}</div><div style="font-size:22px; font-weight:800; margin-top:8px;">${qty.toLocaleString("vi-VN")}</div><div class="muted" style="font-size:12px;">${records.length} mã tài sản/vật tư</div><div style="font-size:12px; color:#2563eb; margin-top:8px;">Xem danh sách →</div></button>`;
  }).join("");
}
function openDashboardUsageLocation(location) {
  const detail = document.getElementById("dashboardUsageDetail"); if (!detail) return;
  const records = STATE.devices.filter(d => getDeviceUsageAtLocation(d, location) > 0);
  const rows = records.map(d => `<tr><td><b>${escapeHtml(d.code || "-")}</b></td><td>${escapeHtml(d.name || d.code || "-")}</td><td>${escapeHtml(d.category || "-")}</td><td>${getDeviceUsageAtLocation(d, location).toLocaleString("vi-VN")} ${escapeHtml(d.unit || "cái")}</td><td>${escapeHtml(displayDeviceStatus(d))}</td></tr>`).join("");
  const total = records.reduce((sum,d) => sum + getDeviceUsageAtLocation(d, location), 0);
  detail.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:start; gap:10px; flex-wrap:wrap;"><div><h3 style="margin:0 0 5px;">📍 ${escapeHtml(location)}</h3><div class="muted">${records.length} mã · tổng ${total.toLocaleString("vi-VN")}</div></div><div style="display:flex; gap:8px;"><button type="button" class="primary" onclick="showDevicesAtLocation('${escapeJs(location)}')">Mở danh sách đầy đủ</button><button type="button" class="secondary" data-act="dashboard-usage-close">Đóng</button></div></div>${records.length ? `<div style="overflow-x:auto; margin-top:12px;"><table class="table"><thead><tr><th>Mã</th><th>Tên</th><th>Danh mục</th><th>Số lượng tại nơi dùng</th><th>Tình trạng</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Chưa có tài sản/vật tư được ghi nhận tại đây.</p>'}`;
  detail.classList.remove("hidden"); detail.scrollIntoView({behavior:"smooth", block:"start"});
}

function openDashboardLocation(location) {
  const detail = document.getElementById("dashboardLocationDetail");
  if (!detail) return;
  const records = STATE.devices.filter(d => getWarehouseQuantityAtLocation(d, location) > 0);
  const rows = records.map(d => {
    const qty = getWarehouseQuantityAtLocation(d, location);
    return `<tr><td><b>${escapeHtml(d.code || "-")}</b></td><td>${escapeHtml(d.name || d.code || "-")}</td><td>${escapeHtml(d.category || "-")}</td><td>${qty.toLocaleString("vi-VN")} ${escapeHtml(d.unit || "cái")}</td><td>${escapeHtml(displayDeviceStatus(d))}</td></tr>`;
  }).join("");
  detail.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:start; gap:10px; flex-wrap:wrap;"><div><h3 style="margin:0 0 5px;">📍 ${escapeHtml(location)}</h3><div class="muted">${records.length} mã tài sản/vật tư · tổng số lượng ${records.reduce((sum,d) => sum + getWarehouseQuantityAtLocation(d, location),0).toLocaleString("vi-VN")}</div></div><div style="display:flex; gap:8px;"><button type="button" class="primary" onclick="showDevicesAtLocation('${escapeJs(location)}')">Mở danh sách đầy đủ</button><button type="button" class="secondary" data-act="dashboard-location-close">Đóng</button></div></div>${records.length ? `<div style="overflow-x:auto; margin-top:12px;"><table class="table"><thead><tr><th>Mã</th><th>Tên tài sản/vật tư</th><th>Danh mục</th><th>Số lượng tại kho</th><th>Tình trạng</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Kho này hiện chưa có thiết bị/vật tư được ghi nhận.</p>'}`;
  detail.classList.remove("hidden");
  detail.scrollIntoView({behavior:"smooth", block:"start"});
}

function showDevicesAtLocation(location) {
  showView("devices");
  const filter = document.getElementById("filterLocation");
  if (filter) {
    if (![...filter.options].some(o => o.value === location)) filter.add(new Option(location, location));
    filter.value = location;
  }
  renderDevices();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[ch]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }
function escapeJs(value) { return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\r\n]/g, " "); }

// BỘ LỌC ĐA NĂNG
function deviceMatchesStatusFilter(d, filter) {
  const stock = deviceStockQuantity(d);
  const usage = deviceUsageQuantity(d);
  const damaged = d.trackingMode === "quantity"
    ? sumQtyMap(d.damagedByLocation) + sumQtyMap(d.usageDamagedByLocation)
    : (/hỏng|bảo hành/i.test(d.status || "") ? 1 : 0);
  const repair = d.trackingMode === "quantity"
    ? sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation)
    : (/đang sửa chữa/i.test(d.status || "") ? 1 : 0);
  const disposed = d.trackingMode === "quantity" ? sumQtyMap(d.disposedByLocation) : (/thanh lý/i.test(d.status || "") ? 1 : 0);
  if (!filter) return true;
  if (filter === "stock") return stock > 0;
  if (filter === "usage") return usage > 0;
  if (filter === "damaged") return damaged > 0;
  if (filter === "repair") return repair > 0;
  if (filter === "disposed") return disposed > 0;
  if (filter === "empty") return stock + usage + damaged + repair <= 0;
  if (filter === "lowStock") return d.trackingMode === "quantity" && stock > 0 && stock <= 2;
  if (filter === "noGoodStock") return d.trackingMode === "quantity" && stock <= 0 && (usage + damaged + repair > 0);
  return true;
}

function getFilteredDevices() {
  const q = (document.getElementById("deviceSearch")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("filterCategory")?.value || "";
  const loc = document.getElementById("filterLocation")?.value || "";
  const status = document.getElementById("filterDeviceStatus")?.value || "";

  return STATE.devices.filter(d => {
    const searchable = [d.code, d.name, d.model, d.serial, d.category, d.location, d.usageLocation, d.status, d.notes,
      ...Object.keys(d.stockByLocation || {}), ...Object.keys(d.usageByLocation || {}),
      ...Object.keys(d.damagedByLocation || {}), ...Object.keys(d.repairByLocation || {}), ...Object.keys(d.disposedByLocation || {})]
      .map(v => String(v || "").toLowerCase());
    const matchQ = !q || searchable.some(v => v.includes(q));
    const matchCat = !cat || d.category === cat;
    const matchLoc = !loc || getDeviceQuantityAtLocation(d, loc) > 0;
    const matchStatus = deviceMatchesStatusFilter(d, status);
    return matchQ && matchCat && matchLoc && matchStatus;
  });
}
function resetFilters() {
  const q = document.getElementById("deviceSearch"); if (q) q.value = "";
  const cat = document.getElementById("filterCategory"); if (cat) cat.value = "";
  const loc = document.getElementById("filterLocation"); if (loc) loc.value = "";
  const status = document.getElementById("filterDeviceStatus"); if (status) status.value = "";
  renderDevices();
}

function renderDevices() {
  const filtered = getFilteredDevices();
  const tbody = document.getElementById("deviceTableBody");
  const countEl = document.getElementById("filterResultCount");
  const isAdmin = STATE.currentUser?.role === "admin";
  if (countEl) countEl.innerText = `Đang hiển thị ${filtered.length} / ${STATE.devices.length} mã tài sản/vật tư`;
  if (!tbody) return;

  tbody.innerHTML = filtered.map(d => {
    const isChecked = selectedCodes.has(d.code);
    const codeText = escapeHtml(d.code || "—");
    const codeAttr = escapeAttr(d.code || "");
    const unitText = escapeHtml(d.unit || "cái");
    let locationText = d.usageLocation || d.location || "—";
    let locationTitle = String(locationText || "—");
    if (d.trackingMode === "quantity") {
      const parts = [];
      const addMap = (map, prefix = "") => Object.entries(map || {}).filter(([, qty]) => Number(qty) > 0)
        .forEach(([loc, qty]) => parts.push(`${prefix}${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`));
      addMap(d.stockByLocation);
      addMap(d.usageByLocation, "Đang dùng — ");
      addMap(d.damagedByLocation, "Hỏng — ");
      addMap(d.usageDamagedByLocation, "Hỏng tại nơi dùng — ");
      addMap(d.repairByLocation, "Đang sửa — ");
      addMap(d.usageRepairByLocation, "Đang sửa tại nơi dùng — ");
      addMap(d.disposedByLocation, "Thanh lý — ");
      locationTitle = parts.join("; ") || String(d.location || "—");
      const first = parts[0] || String(d.location || "—");
      locationText = parts.length > 1 ? `${first} <span class="location-more">+${parts.length - 1} vị trí/trạng thái</span>` : escapeHtml(first);
    } else {
      locationTitle = String(locationText || "—");
      locationText = `<span class="location-compact">${escapeHtml(locationTitle)}</span>`;
    }
    const locationTitleAttr = escapeAttr(locationTitle);
    const status = displayDeviceStatus(d);
    const statusClass = d.trackingMode === "quantity"
      ? (deviceStockQuantity(d) > 0 ? "badge-primary" : (deviceDamagedQuantity(d) > 0 ? "badge-danger" : "badge-secondary"))
      : (d.status === "Trong kho" ? "badge-primary" : (d.status === "Đang sử dụng" ? "badge-secondary" : "badge-danger"));
    return `
      <tr>
        <td>${isAdmin ? `<input type="checkbox" class="dev-check" value="${codeAttr}" ${isChecked ? "checked" : ""} aria-label="Chọn ${codeText}">` : ""}</td>
        <td><b>${codeText}</b></td>
        <td><div><b>${escapeHtml(d.name || d.code || "—")}</b></div>
          ${d.notes ? `<small class="muted device-note">${escapeHtml(d.notes)}</small>` : ""}
        </td>
        <td>${escapeHtml(d.model || "—")}</td>
        <td><code>${escapeHtml(d.serial || "—")}</code></td>
        <td>${escapeHtml(d.category || "—")}</td>
        <td class="device-location-cell"><b title="${locationTitleAttr}">${locationText}</b></td>
        <td><b>${d.trackingMode === "quantity" ? Number(d.quantity || 0).toLocaleString("vi-VN") : "1"} ${unitText}</b></td>
        <td><span class="badge ${statusClass}">${escapeHtml(status)}</span></td>
        <td class="device-actions">
          <button type="button" class="secondary" data-act="device-history" data-val="${codeAttr}">Lịch sử</button>
          ${isAdmin ? `<button type="button" data-act="quick-mov" data-val="${codeAttr}">Chuyển / Sự cố</button>
          <button type="button" data-act="edit-dev" data-val="${codeAttr}">Sửa</button>
          <button type="button" class="danger-text" data-act="del-dev" data-val="${codeAttr}">Xóa</button>` : ""}
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="10" class="muted empty-state">Không tìm thấy tài sản/vật tư phù hợp. Hãy thử bỏ bớt bộ lọc hoặc tìm theo mã quản lý.</td></tr>`;
  applyTablePagination("deviceTableBody", "devices");
  updateFloatingBar();
}
function toggleSelectDevice(code, isChecked) {
  if (isChecked) selectedCodes.add(code);
  else selectedCodes.delete(code);
  updateFloatingBar();
}

function toggleSelectAllFiltered(masterCheckbox) {
  const filtered = getFilteredDevices();
  filtered.forEach(d => {
    if (masterCheckbox.checked) selectedCodes.add(d.code);
    else selectedCodes.delete(d.code);
  });
  renderDevices();
}

function clearSelected() {
  selectedCodes.clear();
  const master = document.getElementById("selectAllCheckbox");
  if (master) master.checked = false;
  renderDevices();
}

function updateFloatingBar() {
  const bar = document.getElementById("floatingBar");
  const countEl = document.getElementById("selectedCount");
  if (!bar) return;

  if (selectedCodes.size > 0 && STATE.currentUser?.role === "admin") {
    if (countEl) countEl.innerText = selectedCodes.size;
    bar.classList.remove("hidden");
    bar.style.setProperty("display", "flex", "important");
  } else {
    bar.classList.add("hidden");
    bar.style.setProperty("display", "none", "important");
  }
}

// ----------------------------------------------------
// THAO TÁC THIẾT BỊ
// ----------------------------------------------------
function categoryPrefix(category) {
  const name = String(category || "TS").trim();
  const known = [
    [/cáp|cap/i, "CAP"], [/dây nhảy|patchcord/i, "DNQ"], [/odf/i, "ODF"],
    [/switch|thiết bị mạng/i, "SW"], [/router/i, "RTR"], [/firewall/i, "FW"],
    [/camera/i, "CAM"], [/máy tính|laptop|computer/i, "MT"], [/máy in|printer/i, "MPR"],
    [/ups|lưu điện/i, "UPS"], [/server|máy chủ/i, "SRV"], [/hộp phối quang/i, "HPQ"],
    [/vật tư/i, "VT"]
  ];
  const hit = known.find(([re]) => re.test(name));
  if (hit) return hit[1];
  const words = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toUpperCase().match(/[A-Z0-9]+/g) || ["TS"];
  return words.length > 1 ? words.slice(0, 3).map(w => w[0]).join("") : words[0].slice(0, 4);
}

function suggestDeviceCode(force = false) {
  const codeEl = document.getElementById("devCode");
  const category = document.getElementById("devCategory")?.value || "";
  if (!codeEl || codeEl.readOnly) return;
  if (!force && codeEl.value.trim() && codeEl.dataset.manual === "true") return;
  const prefix = categoryPrefix(category);
  const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-(\\d+)$", "i");
  let max = 0;
  STATE.devices.forEach(d => {
    const m = String(d.code || "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  let next = max + 1;
  let candidate = `${prefix}-${String(next).padStart(4, "0")}`;
  while (STATE.devices.some(d => String(d.code).toLowerCase() === candidate.toLowerCase())) {
    next++;
    candidate = `${prefix}-${String(next).padStart(4, "0")}`;
  }
  codeEl.value = candidate;
  codeEl.dataset.manual = force ? "false" : "auto";
}

function markDeviceCodeManual() {
  const el = document.getElementById("devCode");
  if (el && !el.readOnly) el.dataset.manual = "true";
}

function defaultUnitForCategory(category) {
  const cat = String(category || "").toLowerCase();
  if (/cáp|cap|dây điện|dây mạng|dây quang|dây dẫn/i.test(cat)) return "mét";
  if (/dây nhảy|patch.?cord|jumper/i.test(cat)) return "sợi";
  if (/odf|switch|router|firewall|camera|máy tính|laptop|máy in|ups|lưu điện|server|máy chủ|hộp phối quang|thiết bị|đầu nối|connector|adapter|vật tư/i.test(cat)) return "cái";
  return "cái";
}

function unitForCategory(category) {
  const key = String(category || "").trim();
  return String(STATE.categoryUnits?.[key] || defaultUnitForCategory(key));
}

function handleDeviceCategoryChange() {
  const codeEl = document.getElementById("devCode");
  if (codeEl && (!codeEl.value.trim() || codeEl.dataset.manual !== "true")) suggestDeviceCode(false);
  const selectedCategory = String(document.getElementById("devCategory")?.value || "");
  const unitEl = document.getElementById("devUnit");
  if (unitEl && selectedCategory) unitEl.value = unitForCategory(selectedCategory);
  const cat = selectedCategory.toLowerCase();
  const mode = /cáp|cap|dây nhảy|patchcord|vật tư|dây điện|đầu nối|hộp phối quang/i.test(cat) ? "quantity" : "individual";
  const modeEl = document.getElementById("devTrackingMode");
  if (modeEl && !document.getElementById("devCode")?.readOnly) modeEl.value = mode;
  handleTrackingModeChange();
}

function handleTrackingModeChange() {
  const mode = document.getElementById("devTrackingMode")?.value || "individual";
  const serialWrap = document.getElementById("devSerialWrap");
  const qtyWrap = document.getElementById("devQuantityWrap");
  const qty = document.getElementById("devQuantity");
  const unit = document.getElementById("devUnit");
  if (serialWrap) serialWrap.style.display = mode === "individual" ? "block" : "none";
  if (qtyWrap) qtyWrap.style.display = "grid";
  if (qty) {
    qty.required = true;
    if (mode === "individual") { qty.value = "1"; qty.readOnly = true; }
    else qty.readOnly = false;
  }
  if (unit && mode === "individual" && !unit.value) unit.value = "cái";
}

function openDeviceModal(deviceCode = null) {
  populateSelects();
  showModalById("deviceModal");
  const titleEl = document.getElementById("deviceModalTitle");
  const codeEl = document.getElementById("devCode");
  if (deviceCode) {
    const clean = String(deviceCode).trim().toLowerCase();
    const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === clean);
    if (dev) {
      if (titleEl) titleEl.innerText = "Chỉnh sửa tài sản / vật tư";
      codeEl.value = dev.code || "";
      codeEl.readOnly = true;
      codeEl.dataset.manual = "true";
      setElementValueSafe("devName", dev.name || "");
      setElementValueSafe("devModel", dev.model || "");
      setElementValueSafe("devSerial", dev.serial || "");
      setElementValueSafe("devCategory", dev.category || "", true);
      setElementValueSafe("devLocation", dev.location || "", true);
      setElementValueSafe("devStatus", dev.status || "Trong kho", true);
      setElementValueSafe("devTrackingMode", dev.trackingMode || (dev.quantity > 1 && !dev.serial ? "quantity" : "individual"), true);
      setElementValueSafe("devQuantity", dev.quantity ?? 1);
      setElementValueSafe("devUnit", dev.unit || "cái");
      setElementValueSafe("devNotes", dev.notes || "");
      handleTrackingModeChange();
      return;
    }
  }
  if (titleEl) titleEl.innerText = "Thêm tài sản / vật tư";
  codeEl.value = "";
  codeEl.readOnly = false;
  codeEl.dataset.manual = "false";
  setElementValueSafe("devName", "");
  setElementValueSafe("devModel", "");
  setElementValueSafe("devSerial", "");
  setElementValueSafe("devCategory", STATE.categories[0] || "", true);
  setElementValueSafe("devLocation", STATE.locations[0] || "", true);
  setElementValueSafe("devStatus", "Trong kho", true);
  setElementValueSafe("devTrackingMode", "individual", true);
  setElementValueSafe("devQuantity", "1");
  setElementValueSafe("devUnit", "cái");
  setElementValueSafe("devNotes", "");
  handleDeviceCategoryChange();
}

function scanForDeviceSerial() {
  window._scanTarget = "serial";
  openScannerModal();
}
function scanBulkAssetCode() {
  window._scanTarget = "bulk";
  openScannerModal();
}

function deleteDeviceByCode(code) {
  if (STATE.currentUser?.role !== "admin") return alert("Chỉ Admin mới được xóa tài sản/vật tư.");
  if (STATE.movements.some(m => String(m.deviceCode || "").toLowerCase() === String(code).toLowerCase())) {
    return alert(`Không thể xóa ${code} vì đã có lịch sử giao dịch. Để giữ tính toàn vẹn dữ liệu, hãy giữ mã tài sản này hoặc sao lưu và xử lý lịch sử trước.`);
  }
  if (!confirm(`Bạn có chắc chắn muốn xóa tài sản/vật tư [${code}]? Thao tác không thể hoàn tác.`)) return;
  callMutate("device.delete", { code }).then(() => loadState());
}

async function handleSaveDevice(e) {
  e.preventDefault();
  const code = (document.getElementById("devCode")?.value || "").trim();
  const name = (document.getElementById("devName")?.value || "").trim();
  const model = (document.getElementById("devModel")?.value || "").trim();
  const serial = (document.getElementById("devSerial")?.value || "").trim();
  const category = document.getElementById("devCategory")?.value || "";
  const location = document.getElementById("devLocation")?.value || "";
  const status = document.getElementById("devStatus")?.value || "Trong kho";
  const trackingMode = document.getElementById("devTrackingMode")?.value || "individual";
  const quantity = trackingMode === "individual" ? 1 : Number(document.getElementById("devQuantity")?.value || 0);
  const unit = (document.getElementById("devUnit")?.value || "cái").trim() || "cái";
  const notes = (document.getElementById("devNotes")?.value || "").trim();
  const isEdit = document.getElementById("devCode")?.readOnly;
  if (!code || !name || !category) return alert("Vui lòng nhập mã, tên và chọn danh mục.");
  if (!isEdit && STATE.devices.some(d => String(d.code).toLowerCase() === code.toLowerCase())) return alert("Mã quản lý đã tồn tại. Hãy tạo mã khác.");
  if (trackingMode === "quantity" && (!Number.isFinite(quantity) || quantity <= 0)) return alert("Số lượng phải lớn hơn 0.");
  if (trackingMode === "individual" && quantity !== 1) return alert("Tài sản quản lý từng chiếc phải có số lượng bằng 1. Muốn nhập nhiều, hãy chọn quản lý theo số lượng.");
  const action = isEdit ? "device.update" : "device.add";
  const result = await callMutate(action, { code, name, model, serial: trackingMode === "individual" ? serial : "", category, location, status, notes, trackingMode, quantity, unit });
  if (result && result.error) return;
  closeModal("deviceModal");
  await loadState();
}

// ----------------------------------------------------
// ĐIỀU CHUYỂN / BÁO SỰ CỐ
// ----------------------------------------------------
function openMovementModal(deviceCode = null) {
  const searchBox = document.getElementById("movDeviceSearch"); if (searchBox) searchBox.value = "";
  populateSelects(); showModalById("movementModal");
  setElementValueSafe("movType", "Xuất kho sử dụng", true);
  ["movNote", "movDepartment", "movRecipient", "movReferenceNo"].forEach(id => setElementValueSafe(id, ""));
  if (deviceCode) setElementValueSafe("movDeviceCode", deviceCode, true);
  const chosen = STATE.devices.find(d => String(d.code).toLowerCase() === String(document.getElementById("movDeviceCode")?.value).toLowerCase());
  if (chosen?.status === "Đang sử dụng") setElementValueSafe("movType", "Điều chuyển nơi sử dụng", true);
  else if (/Hỏng|Bảo hành/i.test(chosen?.status || "")) setElementValueSafe("movType", "Đã sửa xong / Nhập lại kho", true);
  else if (chosen?.trackingMode === "quantity" && sumQtyMap(chosen.stockByLocation) <= 0 && sumQtyMap(chosen.usageByLocation) > 0) setElementValueSafe("movType", "Thu hồi về kho", true);
  handleSelectDeviceForMovement();
}
function handleSelectDeviceForMovement() {
  const dev = STATE.devices.find(d => String(d.code).toLowerCase() === String(document.getElementById("movDeviceCode")?.value).toLowerCase());
  const qtyWrap = document.getElementById("movQuantityWrap"); if (qtyWrap) qtyWrap.classList.toggle("hidden", dev?.trackingMode !== "quantity");
  if (dev?.trackingMode === "quantity") setElementValueSafe("movQuantity", "1");
  const fromW = document.getElementById("movFromLocation");
  if (fromW) { const map = dev?.stockByLocation || {}; const opts = STATE.locations.filter(l => dev?.trackingMode !== "quantity" || Number(map[l] || 0) > 0); fromW.innerHTML = (opts.length ? opts : STATE.locations).map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}${dev?.trackingMode === "quantity" ? ` — còn ${Number(map[l] || 0).toLocaleString("vi-VN")} ${escapeHtml(dev.unit || "cái")}` : ""}</option>`).join(""); if (dev?.location && Array.from(fromW.options).some(o => o.value === dev.location)) fromW.value = dev.location; }
  const fromU = document.getElementById("movFromUsageLocation");
  if (fromU) { const map = dev?.usageByLocation || {}; const places = STATE.usageLocations.map(l => l.name || l); const opts = places.filter(l => dev?.trackingMode !== "quantity" || Number(map[l] || 0) > 0); fromU.innerHTML = (opts.length ? opts : places).map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}${dev?.trackingMode === "quantity" ? ` — đang dùng ${Number(map[l] || 0).toLocaleString("vi-VN")} ${escapeHtml(dev.unit || "cái")}` : ""}</option>`).join(""); const currentUse = dev?.usageLocation || (dev?.status === "Đang sử dụng" ? dev.location : "") || Object.keys(map).find(l => Number(map[l]) > 0); if (currentUse && Array.from(fromU.options).some(o => o.value === currentUse)) fromU.value = currentUse; }
  const sourceType = document.getElementById("movDamageSourceType");
  if (sourceType && dev) {
    const hasUsage = dev.trackingMode === "quantity" ? sumQtyMap(dev.usageByLocation) > 0 : dev.status === "Đang sử dụng";
    sourceType.value = hasUsage && (dev.status === "Đang sử dụng" || sumQtyMap(dev.stockByLocation) <= 0) ? "usage" : "warehouse";
  }
  handleMovementTypeChange();
}
function handleMovementTypeChange() {
  const type = document.getElementById("movType")?.value || "Xuất kho sử dụng";
  const isIn = type === "Nhập kho", isUseOut = type === "Xuất kho sử dụng", isTransfer = type === "Điều chuyển kho", isReturn = type === "Thu hồi về kho", isUseTransfer = type === "Điều chuyển nơi sử dụng", isRepair = type === "Đã sửa xong / Nhập lại kho", isSendRepair = type === "Chuyển sang sửa chữa", isDamage = type === "Báo hỏng / Đi bảo hành", isDispose = type === "Báo thanh lý";
  const sourceTypeEl = document.getElementById("movDamageSourceType");
  let sourceType = sourceTypeEl?.value || "warehouse";
  if (isDamage && !["warehouse", "usage"].includes(sourceType)) { sourceType = "warehouse"; if (sourceTypeEl) sourceTypeEl.value = sourceType; }
  if (sourceTypeEl) Array.from(sourceTypeEl.options).forEach(opt => { if (["damaged", "repair"].includes(opt.value)) opt.hidden = !isDispose; });
  const needsSourceChoice = isDamage || isDispose;
  document.getElementById("movDamageSourceWrap")?.classList.toggle("hidden", !needsSourceChoice);
  const showFromW = !isIn && !isReturn && !isUseTransfer && (!needsSourceChoice || sourceType === "warehouse" || (isDispose && ["damaged", "repair"].includes(sourceType)));
  const showFromU = isReturn || isUseTransfer || (needsSourceChoice && sourceType === "usage");
  const showToW = isIn || isTransfer || isReturn || isDamage || isRepair || isSendRepair || isDispose;
  const showUsage = isUseOut || isUseTransfer;
  document.getElementById("movFromWarehouseWrap")?.classList.toggle("hidden", !showFromW);
  document.getElementById("movFromUsageWrap")?.classList.toggle("hidden", !showFromU);
  document.getElementById("movToWarehouseWrap")?.classList.toggle("hidden", !showToW);
  document.getElementById("movUsageWrap")?.classList.toggle("hidden", !showUsage);
  const to = document.getElementById("movToLocation"); if (to) to.required = showToW;
  const use = document.getElementById("movUsageLocation"); if (use) use.required = showUsage;
  const fw = document.getElementById("movFromLocation"); if (fw) fw.required = showFromW;
  const fu = document.getElementById("movFromUsageLocation"); if (fu) fu.required = isReturn || isUseTransfer || (needsSourceChoice && sourceType === "usage");
  const dev = STATE.devices.find(d => d.code === document.getElementById("movDeviceCode")?.value);
  if (dev?.trackingMode === "quantity") {
    const map = isRepair ? (Number((dev.repairByLocation || {})[fw?.value] || 0) > 0 ? dev.repairByLocation : (dev.damagedByLocation || {})) : isSendRepair ? (dev.damagedByLocation || {}) : (isDispose && sourceType === "damaged") ? (dev.damagedByLocation || {}) : (isDispose && sourceType === "repair") ? (dev.repairByLocation || {}) : (dev.stockByLocation || {});
    const opts = STATE.locations.filter(l => Number(map[l] || 0) > 0);
    if (fw) { const previous = fw.value; fw.innerHTML = (opts.length ? opts : STATE.locations).map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}${opts.length ? ` — ${isRepair ? "đang sửa/hỏng" : isSendRepair ? "hàng hỏng" : "còn"} ${Number(map[l] || 0).toLocaleString("vi-VN")} ${escapeHtml(dev.unit || "cái")}` : ""}</option>`).join(""); if (opts.includes(previous)) fw.value = previous; }
  }
  if ((isIn || isTransfer || isReturn || isRepair || isDispose) && to && !to.value) setElementValueSafe("movToLocation", STATE.locations[0] || "", true);
  if (isUseTransfer) { const targetUse = document.getElementById("movUsageLocation"); const sourceUse = document.getElementById("movFromUsageLocation")?.value; const alternative = STATE.usageLocations.map(l => l.name || l).find(l => l !== sourceUse); if (targetUse && alternative && targetUse.value === sourceUse) targetUse.value = alternative; }
  const note = document.getElementById("movNote"); if (note) note.placeholder = isIn ? "Nguồn nhập, số hóa đơn/biên bản..." : isUseOut ? "Mục đích cấp phát, công trình..." : isDamage ? "Mô tả hư hỏng..." : "Ghi chú / lý do giao dịch...";
  const label = document.getElementById("movAvailableQty");
  if (label && dev?.trackingMode === "quantity") { const source = (isReturn || isUseTransfer || (needsSourceChoice && sourceType === "usage")) ? Number((dev.usageByLocation || {})[fu?.value] || 0) : (isRepair ? Number(((Number((dev.repairByLocation || {})[fw?.value] || 0) > 0 ? dev.repairByLocation : dev.damagedByLocation) || {})[fw?.value] || 0) : isSendRepair || (isDispose && sourceType === "damaged") ? Number((dev.damagedByLocation || {})[fw?.value] || 0) : (isDispose && sourceType === "repair") ? Number((dev.repairByLocation || {})[fw?.value] || 0) : Number((dev.stockByLocation || {})[fw?.value] || 0)); label.textContent = `Số dư nguồn hiện tại: ${source.toLocaleString("vi-VN")} ${dev.unit || "cái"}`; } else if (label) label.textContent = "";
}
async function handleSaveMovement(e) {
  e.preventDefault();
  const deviceCode = document.getElementById("movDeviceCode")?.value, type = document.getElementById("movType")?.value;
  const dev = STATE.devices.find(d => d.code === deviceCode); if (!dev) return alert("Không tìm thấy mặt hàng.");
  const isIn = type === "Nhập kho", isUseOut = type === "Xuất kho sử dụng", isTransfer = type === "Điều chuyển kho", isReturn = type === "Thu hồi về kho", isUseTransfer = type === "Điều chuyển nơi sử dụng", isRepair = type === "Đã sửa xong / Nhập lại kho", isSendRepair = type === "Chuyển sang sửa chữa", isDamage = type === "Báo hỏng / Đi bảo hành", isDispose = type === "Báo thanh lý";
  const fromLocation = document.getElementById("movFromLocation")?.value || "", toLocation = document.getElementById("movToLocation")?.value || "", usageLocation = document.getElementById("movUsageLocation")?.value || "", fromUsage = document.getElementById("movFromUsageLocation")?.value || "";
  const quantity = dev.trackingMode === "quantity" ? Number(document.getElementById("movQuantity")?.value) : 1;
  let sourceUsage = (isReturn || isUseTransfer) ? fromUsage : "";
  const damageSourceType = document.getElementById("movDamageSourceType")?.value || "warehouse";
  if ((isDamage || isDispose) && damageSourceType === "usage") {
    if (dev.trackingMode === "quantity") {
      const availableAtUse = Number((dev.usageByLocation || {})[fromUsage] || 0);
      if (availableAtUse < quantity) return alert(`Không đủ số lượng tại nơi sử dụng ${fromUsage}. Hiện có ${availableAtUse} ${dev.unit || "cái"}.`);
      sourceUsage = fromUsage;
    } else {
      if (dev.status !== "Đang sử dụng") return alert("Tài sản cá thể không ở trạng thái đang sử dụng.");
      sourceUsage = dev.usageLocation || dev.location || fromUsage;
    }
  }
  const payload = { deviceCode, type, sourceMode: damageSourceType, fromLocation: (isIn || isReturn || isUseTransfer || sourceUsage) ? "" : fromLocation, toLocation: (isUseOut || isUseTransfer) ? "" : toLocation, usageLocation: (isUseOut || isUseTransfer) ? usageLocation : "", fromUsageLocation: sourceUsage, quantity, department: document.getElementById("movDepartment")?.value.trim() || "", recipient: document.getElementById("movRecipient")?.value.trim() || "", referenceNo: document.getElementById("movReferenceNo")?.value.trim() || "", note: document.getElementById("movNote")?.value.trim() || "" };
  try { await callMutate("movement.create", payload); closeModal("movementModal"); await loadState(); } catch (err) { /* server validation already shown */ }
}

function getFilteredMovements() {
  const query = (document.getElementById("movementSearch")?.value || "").trim().toLowerCase();
  const type = document.getElementById("movementTypeFilter")?.value || "";
  const status = document.getElementById("movementStatusFilter")?.value || "";
  return (STATE.movements || []).filter(m => {
    const cancelled = Boolean(m.cancelled || m.cancelledAt);
    const haystack = [m.id, m.batchId, m.deviceCode, m.type, m.fromLocation, m.fromUsageLocation, m.toLocation, m.usageLocation,
      m.note, m.department, m.recipient, m.referenceNo, m.createdBy, m.cancelledBy, m.cancelReason]
      .map(v => String(v || "").toLowerCase());
    return (!type || m.type === type) && (!status || (status === "cancelled" ? cancelled : !cancelled)) && (!query || haystack.some(v => v.includes(query)));
  });
}

function resetMovementFilters() {
  ["movementSearch", "movementTypeFilter", "movementStatusFilter"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  renderMovements();
}

function renderMovements() {
  const tbody = document.getElementById("movementTableBody");
  if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";
  const filteredMovements = getFilteredMovements();
  const resultCount = document.getElementById("movementResultCount");
  if (resultCount) resultCount.textContent = `Hiển thị ${filteredMovements.length} / ${STATE.movements.length} bản ghi`;
  tbody.innerHTML = filteredMovements.map(m => {
    const isCancelled = Boolean(m.cancelled || m.cancelledAt);
    const canCancel = isAdmin && !isCancelled && Boolean(m.id && m.deviceBefore && m.deviceAfter && m.deviceCode);
    const stateBadge = isCancelled
      ? `<div><span class="badge badge-danger">ĐÃ HỦY</span><small style="display:block;margin-top:4px;">${escapeHtml(m.cancelledBy || "-")} · ${m.cancelledAt ? new Date(m.cancelledAt).toLocaleString("vi-VN") : ""}</small><small style="display:block;">${escapeHtml(m.cancelReason || "")}</small></div>`
      : `<span class="badge ${m.type && (m.type.includes('hỏng') || m.type.includes('thanh lý')) ? 'badge-danger' : 'badge-secondary'}">${escapeHtml(m.type || "Giao dịch")}</span>`;
    return `
    <tr style="${isCancelled ? "opacity:.72;background:#f8fafc;" : ""}">
      <td>${m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "-"}</td>
      <td><b>${escapeHtml(m.deviceCode || "-")}</b>${m.batchId ? `<small style="display:block;color:#64748b;">${escapeHtml(m.batchId)}</small>` : ""}</td>
      <td>${stateBadge}${isCancelled ? `<small style="display:block;text-decoration:line-through;color:#64748b;margin-top:3px;">${escapeHtml(m.type || "Giao dịch")}</small>` : ""}</td>
      <td>${escapeHtml(m.fromLocation || m.fromUsageLocation || "-")}</td>
      <td><b>${escapeHtml(m.toLocation || m.usageLocation || "-")}</b></td>
      <td><small>${Number(m.quantity || 1).toLocaleString("vi-VN")} ${escapeHtml(m.unit || "cái")}${m.department ? ` · ${escapeHtml(m.department)}` : ""}${m.recipient ? ` · Người nhận: ${escapeHtml(m.recipient)}` : ""}${m.referenceNo ? ` · Phiếu: ${escapeHtml(m.referenceNo)}` : ""}${m.note ? ` · ${escapeHtml(m.note)}` : ""}</small></td>
      <td>${escapeHtml(m.createdBy || "-")}</td>
      ${isAdmin ? `<td><div style="display:flex;gap:6px;flex-wrap:wrap;">${canCancel ? `<button type="button" class="danger" data-act="cancel-movement" data-val="${escapeAttr(m.id)}" style="color:#b91c1c;">Hủy & hoàn tác</button>` : isCancelled ? `<span class="muted">Đã hủy</span>` : `<button type="button" disabled title="Phiếu cũ thiếu ảnh chụp dữ liệu trước/sau, không thể hoàn tác an toàn">Không thể hoàn tác</button>`}<button type="button" class="secondary" data-act="delete-movement" data-val="${escapeAttr(m.id)}" title="Chỉ xóa nhật ký, không thay đổi dữ liệu thiết bị">Xóa lịch sử</button></div></td>` : ""}
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="muted empty-state">Không tìm thấy phiếu phù hợp với bộ lọc.</td></tr>`;
  applyTablePagination("movementTableBody", "movements");
  const table = tbody.closest("table");
  const headRow = table?.querySelector("thead tr");
  if (headRow) {
    const hasAction = headRow.querySelector('[data-movement-action-header="1"]');
    if (isAdmin && !hasAction) headRow.insertAdjacentHTML("beforeend", '<th class="admin-only" data-movement-action-header="1">Thao tác</th>');
    if (!isAdmin && hasAction) hasAction.remove();
  }
}

async function deleteMovementHistory(id) {
  if (STATE.currentUser?.role !== "admin") return alert("Chỉ Admin mới được xóa lịch sử.");
  const record = STATE.movements.find(m => String(m.id) === String(id));
  if (!record) return alert("Không tìm thấy bản ghi lịch sử.");
  const isBatch = Boolean(record.batchId);
  const scope = isBatch ? `toàn bộ nhật ký của phiếu hàng loạt ${record.batchId}` : `bản ghi ${record.id}`;
  if (!confirm(`XÓA LỊCH SỬ?

Bạn sắp xóa ${scope}.

Thao tác này chỉ xóa nhật ký, KHÔNG thay đổi trạng thái, vị trí hoặc số lượng thiết bị. Không thể khôi phục lịch sử đã xóa.

Bạn đã sao lưu dữ liệu chưa?`)) return;
  try {
    await callMutate("movement.delete", { id });
    await loadState();
    alert("Đã xóa nhật ký. Dữ liệu thiết bị/kho không bị thay đổi.");
  } catch (e) { /* API hiển thị lỗi */ }
}

async function cancelMovement(id) {
  if (!id) return alert("Phiếu này thiếu mã định danh nên không thể hủy an toàn.");
  const record = STATE.movements.find(m => String(m.id) === String(id));
  if (!record) return alert("Không tìm thấy phiếu. Hãy tải lại trang.");
  if (record.cancelled || record.cancelledAt) return alert("Phiếu này đã được hủy.");
  if (!record.deviceBefore || !record.deviceAfter) return alert("Phiếu cũ không có dữ liệu trước/sau giao dịch. Không thể hoàn tác an toàn.");
  const scope = record.batchId ? `Toàn bộ phiếu hàng loạt ${record.batchId}` : `Phiếu ${record.id}`;
  const reason = prompt(`${scope}
${record.type || "Giao dịch"} · ${record.deviceCode || "Không rõ mã"}

Nhập lý do hủy (bắt buộc):`, "Tạo nhầm phiếu trong giai đoạn thử nghiệm");
  if (reason === null) return;
  if (reason.trim().length < 3) return alert("Lý do hủy phải có ít nhất 3 ký tự.");
  if (!confirm(`XÁC NHẬN HỦY VÀ HOÀN TÁC?

${scope}
${record.type || "Giao dịch"}

Hệ thống sẽ kiểm tra toàn bộ tài sản trước khi thay đổi. Nếu có giao dịch tiếp theo hoặc dữ liệu không khớp, toàn bộ thao tác sẽ bị từ chối. Nhật ký sẽ được giữ lại và đánh dấu ĐÃ HỦY.`)) return;
  try {
    await callMutate("movement.cancel", { id, reason: reason.trim() });
    await loadState();
    alert("Đã hủy phiếu và hoàn tác dữ liệu. Lịch sử được giữ lại.");
  } catch (e) { /* API hiển thị lỗi */ }
}

// THEO DÕI THIẾT BỊ HỎNG, SỬA CHỮA, THANH LÝ
function dispositionRows() {
  const rows = [];
  for (const d of STATE.devices) {
    if (d.trackingMode === "quantity") {
      for (const [loc, qty] of Object.entries(d.damagedByLocation || {})) if (Number(qty) > 0) rows.push({ code:d.code, name:d.name, category:d.category, type:"Hỏng / Bảo hành", location:loc, quantity:Number(qty), unit:d.unit||"cái", status:"Chờ xử lý", note:d.notes||"" });
      for (const [loc, qty] of Object.entries(d.usageDamagedByLocation || {})) if (Number(qty) > 0) rows.push({ code:d.code, name:d.name, category:d.category, type:"Hỏng tại nơi sử dụng", location:loc, quantity:Number(qty), unit:d.unit||"cái", status:"Chờ xử lý", note:d.notes||"" });
      for (const [loc, qty] of Object.entries(d.repairByLocation || {})) if (Number(qty) > 0) rows.push({ code:d.code, name:d.name, category:d.category, type:"Đang sửa chữa", location:loc, quantity:Number(qty), unit:d.unit||"cái", status:"Đang sửa chữa", note:d.notes||"" });
      for (const [loc, qty] of Object.entries(d.usageRepairByLocation || {})) if (Number(qty) > 0) rows.push({ code:d.code, name:d.name, category:d.category, type:"Sửa chữa tại nơi sử dụng", location:loc, quantity:Number(qty), unit:d.unit||"cái", status:"Đang sửa chữa", note:d.notes||"" });
      for (const [loc, qty] of Object.entries(d.disposedByLocation || {})) if (Number(qty) > 0) rows.push({ code:d.code, name:d.name, category:d.category, type:"Thanh lý", location:loc, quantity:Number(qty), unit:d.unit||"cái", status:"Thanh lý / Chờ bàn giao", note:d.notes||"" });
    } else {
      if (/hỏng|bảo hành/i.test(d.status || "")) rows.push({ code:d.code, name:d.name, category:d.category, type:"Hỏng / Bảo hành", location:d.location || d.usageLocation || "Chưa xác định", quantity:1, unit:d.unit||"cái", status:d.status, note:d.notes||"" });
      if (/đang sửa chữa/i.test(d.status || "")) rows.push({ code:d.code, name:d.name, category:d.category, type:"Đang sửa chữa", location:d.location || "Chưa xác định", quantity:1, unit:d.unit||"cái", status:d.status, note:d.notes||"" });
      if (/thanh lý/i.test(d.status || "")) rows.push({ code:d.code, name:d.name, category:d.category, type:"Thanh lý", location:d.location || "Chưa xác định", quantity:1, unit:d.unit||"cái", status:d.status, note:d.notes||"" });
    }
  }
  return rows;
}
function getFilteredDispositionRows() {
  const query = (document.getElementById("dispositionSearch")?.value || "").trim().toLowerCase();
  const type = document.getElementById("dispositionTypeFilter")?.value || "";
  const location = document.getElementById("dispositionLocationFilter")?.value || "";
  return dispositionRows().filter(r => (!type || r.type === type) && (!location || r.location === location) && (!query || [r.code,r.name,r.category,r.location,r.status,r.note,r.type].some(v => String(v||"").toLowerCase().includes(query))));
}
function resetDispositionFilters() {
  ["dispositionSearch", "dispositionTypeFilter", "dispositionLocationFilter"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  renderDisposition();
}
function renderDisposition() {
  const body = document.getElementById("dispositionTableBody"); if (!body) return;
  const all = dispositionRows();
  const locationSelect = document.getElementById("dispositionLocationFilter");
  if (locationSelect) {
    const current = locationSelect.value;
    const locations = [...new Set(all.map(r => r.location).filter(Boolean))].sort((a,b) => a.localeCompare(b, "vi"));
    locationSelect.innerHTML = `<option value="">-- Tất cả kho/vị trí --</option>` + locations.map(loc => `<option value="${escapeAttr(loc)}">${escapeHtml(loc)}</option>`).join("");
    if (locations.includes(current)) locationSelect.value = current;
  }
  const filtered = getFilteredDispositionRows();
  const counts = { total: all.reduce((n,r)=>n+r.quantity,0), disposed: all.filter(r=>r.type==="Thanh lý").reduce((n,r)=>n+r.quantity,0), damaged: all.filter(r=>r.type.toLowerCase().includes("hỏng")||r.type.includes("Bảo hành")).reduce((n,r)=>n+r.quantity,0), repair: all.filter(r=>r.type.toLowerCase().includes("sửa chữa")).reduce((n,r)=>n+r.quantity,0) };
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=Number(val).toLocaleString("vi-VN"); };
  set("dispositionTotal", counts.total); set("dispositionDisposed", counts.disposed); set("dispositionDamaged", counts.damaged); set("dispositionRepair", counts.repair);
  body.innerHTML = filtered.map(r => `<tr><td><b>${escapeHtml(r.code)}</b></td><td>${escapeHtml(r.name||"")}</td><td>${escapeHtml(r.category||"")}</td><td><span class="badge ${r.type==="Thanh lý"?"badge-danger":"badge-secondary"}">${escapeHtml(r.type)}</span></td><td><b>${escapeHtml(r.location)}</b></td><td>${Number(r.quantity).toLocaleString("vi-VN")} ${escapeHtml(r.unit)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.note)}</td></tr>`).join("") || `<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">Không có thiết bị/vật tư phù hợp.</td></tr>`;
  const count = document.getElementById("dispositionResultCount"); if(count) count.textContent=`Hiển thị ${filtered.length} dòng quản lý xử lý`;
  applyTablePagination("dispositionTableBody", "disposition");
}
function exportDispositionCSV() {
  const rows = getFilteredDispositionRows();
  const out = [["Mã thiết bị/vật tư","Tên","Danh mục","Nghiệp vụ","Kho/vị trí quản lý","Số lượng","Đơn vị","Trạng thái","Ghi chú"], ...rows.map(r=>[r.code,r.name,r.category,r.type,r.location,r.quantity,r.unit,r.status,r.note])];
  downloadCSV(`theo_doi_hong_sua_chua_thanh_ly_${new Date().toISOString().slice(0,10)}.csv`, out);
}

// ----------------------------------------------------
// XEM CHI TIẾT TÀI SẢN THEO KHO / DANH MỤC / NƠI SỬ DỤNG
// ----------------------------------------------------
let entityInventoryState = { type: "", key: "", rows: [] };
function entityInventoryContainer(type) {
  return document.getElementById(type === "warehouse" ? "warehouseInventoryDetail" : type === "usage" ? "usageInventoryDetail" : "categoryInventoryDetail");
}
function entityInventoryQuantity(device, type, key) {
  if (type === "warehouse") return getWarehouseQuantityAtLocation(device, key);
  if (type === "usage") return getDeviceUsageAtLocation(device, key);
  if (device.trackingMode === "quantity") return Math.max(0, sumQtyMap(device.stockByLocation) + sumQtyMap(device.usageByLocation) + sumQtyMap(device.damagedByLocation) + sumQtyMap(device.usageDamagedByLocation) + sumQtyMap(device.repairByLocation) + sumQtyMap(device.usageRepairByLocation) + sumQtyMap(device.disposedByLocation));
  return Number(device.quantity) > 0 ? Number(device.quantity) : 1;
}
function openEntityInventory(type, key) {
  if (!["warehouse", "usage", "category"].includes(type)) return;
  entityInventoryState = { type, key, rows: [] };
  ["warehouse", "usage", "category"].forEach(t => { const el = entityInventoryContainer(t); if (el) { el.classList.add("hidden"); el.innerHTML = ""; } });
  const el = entityInventoryContainer(type); if (!el) return;
  const title = type === "warehouse" ? "Kho lưu trữ" : type === "usage" ? "Nơi sử dụng" : "Danh mục thiết bị";
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 5px">${title}: ${escapeHtml(key)}</h3><p class="muted" style="margin:0">Danh sách tài sản/vật tư được ghi nhận trong mục này. Số lượng được tính theo trạng thái và vị trí tương ứng.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="primary" data-act="entity-inventory-export">Xuất báo cáo CSV</button><button type="button" class="secondary" data-act="entity-inventory-close">Đóng</button></div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0"><input id="entityInventorySearch" type="search" placeholder="Tìm mã, tên, model, serial..." style="max-width:360px;flex:1"><span id="entityInventoryCount" class="muted"></span></div><div style="overflow-x:auto"><table class="table"><thead><tr><th>STT</th><th>Mã quản lý</th><th>Tên thiết bị/vật tư</th><th>Danh mục</th><th>Model / Serial</th><th>Số lượng tại mục</th><th>Đơn vị</th><th>Tình trạng</th></tr></thead><tbody id="entityInventoryRows"></tbody></table></div>`;
  el.classList.remove("hidden");
  const devices = (STATE.devices || []).filter(d => {
    const qty = entityInventoryQuantity(d, type, key);
    return type === "category" ? String(d.category || "").trim().toLowerCase() === String(key).trim().toLowerCase() : qty > 0;
  });
  entityInventoryState.rows = devices.map(d => ({ device:d, quantity: entityInventoryQuantity(d,type,key) }));
  renderEntityInventoryRows();
  el.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderEntityInventoryRows() {
  const body = document.getElementById("entityInventoryRows"); if (!body) return;
  const q = String(document.getElementById("entityInventorySearch")?.value || "").trim().toLowerCase();
  const rows = entityInventoryState.rows.filter(({device:d}) => !q || [d.code,d.name,d.model,d.serial,d.category,d.notes].some(v => String(v || "").toLowerCase().includes(q)));
  body.innerHTML = rows.map(({device:d,quantity},i) => `<tr><td>${i+1}</td><td><b>${escapeHtml(d.code || "—")}</b></td><td>${escapeHtml(d.name || d.code || "—")}</td><td>${escapeHtml(d.category || "—")}</td><td>${escapeHtml([d.model,d.serial].filter(Boolean).join(" / ") || "—")}</td><td>${Number(quantity || 0).toLocaleString("vi-VN")}</td><td>${escapeHtml(d.unit || "cái")}</td><td>${escapeHtml(displayDeviceStatus(d))}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">Không có thiết bị phù hợp với điều kiện tìm kiếm.</td></tr>`;
  const count = document.getElementById("entityInventoryCount"); if (count) count.textContent = `${rows.length} / ${entityInventoryState.rows.length} mã · Tổng số lượng: ${rows.reduce((s,r)=>s+Number(r.quantity||0),0).toLocaleString("vi-VN")}`;
}
function exportEntityInventory() {
  const q = String(document.getElementById("entityInventorySearch")?.value || "").trim().toLowerCase();
  const rows = entityInventoryState.rows.filter(({device:d}) => !q || [d.code,d.name,d.model,d.serial,d.category,d.notes].some(v => String(v || "").toLowerCase().includes(q)));
  const typeName = entityInventoryState.type === "warehouse" ? "Kho lưu trữ" : entityInventoryState.type === "usage" ? "Nơi sử dụng" : "Danh mục";
  const data = [["Loại báo cáo",typeName],["Tên mục",entityInventoryState.key],["Ngày xuất",new Date().toLocaleString("vi-VN")],[],["Mã quản lý","Tên tài sản/vật tư","Danh mục","Model","Serial/MAC","Số lượng tại mục","Đơn vị tính","Tình trạng","Ghi chú"], ...rows.map(({device:d,quantity})=>[d.code||"",d.name||"",d.category||"",d.model||"",d.serial||"",quantity,d.unit||"cái",displayDeviceStatus(d),d.notes||""])];
  downloadCSV(`bao_cao_${entityInventoryState.type}_${new Date().toISOString().slice(0,10)}.csv`,data);
}
function closeEntityInventory() {
  ["warehouse","usage","category"].forEach(t=>{const el=entityInventoryContainer(t);if(el){el.classList.add("hidden");el.innerHTML="";}});
  entityInventoryState={type:"",key:"",rows:[]};
}

// ----------------------------------------------------
// VỊ TRÍ & KHO (LOCATIONS)
// ----------------------------------------------------
function renderLocations() {
  const tbody = document.getElementById("locationTableBody"); if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";
  tbody.innerHTML = STATE.locations.map((loc, idx) => {
    const count = STATE.devices.reduce((sum, d) => sum + (d.trackingMode === "quantity" ? Number((d.stockByLocation || {})[loc] || 0) + Number((d.damagedByLocation || {})[loc] || 0) + Number((d.repairByLocation || {})[loc] || 0) + Number((d.disposedByLocation || {})[loc] || 0) : (d.status !== "Đang sử dụng" && d.location === loc ? 1 : 0)), 0);
    return `<tr><td>${idx + 1}</td><td><button type="button" class="link-button" data-act="entity-inventory" data-type="warehouse" data-val="${escapeAttr(loc)}" title="Xem danh sách thiết bị trong kho"><b>${escapeHtml(loc)}</b> ↗</button></td><td><span class="badge badge-secondary">${count.toLocaleString("vi-VN")} đơn vị</span></td>${isAdmin ? `<td style="text-align:right;"><button type="button" data-act="rename-loc" data-val="${escapeAttr(loc)}">Đổi tên</button> <button type="button" data-act="del-loc" data-val="${escapeAttr(loc)}" style="color:red">Xóa</button></td>` : `<td></td>`}</tr>`;
  }).join("");
  applyTablePagination("locationTableBody", "locations");
}
async function openAddLocationModal() { const name = prompt("Nhập tên kho lưu trữ mới:"); if (!name || !name.trim()) return; try { await callMutate("location.add", { name: name.trim() }); await loadState(); } catch(e) {} }
async function renameLocation(oldName) { const newName = prompt(`Đổi tên kho "${oldName}" thành:`, oldName); if (!newName || !newName.trim() || newName.trim() === oldName) return; try { await callMutate("location.update", { oldName, newName: newName.trim() }); await loadState(); } catch(e) {} }
async function deleteLocation(name) { if (!confirm(`Bạn có chắc muốn xóa kho "${name}"?`)) return; try { await callMutate("location.delete", { name }); await loadState(); } catch(e) {} }
function renderUsageLocations() {
  const tbody = document.getElementById("usageLocationTableBody"); if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";
  tbody.innerHTML = STATE.usageLocations.map((l, idx) => { const name = l.name || l; const qty = STATE.devices.reduce((sum,d) => sum + getDeviceUsageAtLocation(d,name),0); return `<tr><td>${idx+1}</td><td><button type="button" class="link-button" data-act="entity-inventory" data-type="usage" data-val="${escapeAttr(name)}" title="Xem thiết bị tại nơi sử dụng"><b>${escapeHtml(name)}</b> ↗</button></td><td>${escapeHtml(l.department || "-")}</td><td>${escapeHtml(l.manager || "-")}</td><td>${escapeHtml(l.address || "-")}</td><td><span class="badge badge-secondary">${qty.toLocaleString("vi-VN")}</span></td><td>${isAdmin ? (l.legacy ? `<button type="button" data-act="edit-usage-loc" data-val="${escapeAttr(name)}">Khai báo</button>` : `<button type="button" data-act="edit-usage-loc" data-val="${escapeAttr(l.id || name)}">Sửa</button> <button type="button" data-act="del-usage-loc" data-val="${escapeAttr(l.id || name)}" style="color:#b91c1c">Xóa</button>`) : (l.legacy ? `<span class="badge badge-danger">Chưa chuẩn hóa</span>` : "")}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">Chưa có nơi sử dụng.</td></tr>`;
  applyTablePagination("usageLocationTableBody", "usageLocations");
}
function openUsageLocationModal(idOrName = null) {
  const found = idOrName ? STATE.usageLocations.find(l => String(l.id || l.name || l) === String(idOrName) || String(l.name || l) === String(idOrName)) : null;
  const title = document.getElementById("usageLocationModalTitle"); if (title) title.innerText = found ? "Sửa nơi sử dụng" : "Thêm nơi sử dụng";
  setElementValueSafe("usageLocationId", found?.id || ""); setElementValueSafe("usageLocationOldName", found?.name || found || ""); setElementValueSafe("usageLocationName", found?.name || found || "");
  setElementValueSafe("usageLocationDepartment", found?.department || ""); setElementValueSafe("usageLocationManager", found?.manager || ""); setElementValueSafe("usageLocationAddress", found?.address || ""); showModalById("usageLocationModal");
}
async function saveUsageLocation(e) { e.preventDefault(); const id = document.getElementById("usageLocationId").value, oldName = document.getElementById("usageLocationOldName").value; const found = STATE.usageLocations.find(l => String(l.name || l).toLowerCase() === String(oldName).toLowerCase()); const payload = { id, oldName, name: document.getElementById("usageLocationName").value.trim(), department: document.getElementById("usageLocationDepartment").value.trim(), manager: document.getElementById("usageLocationManager").value.trim(), address: document.getElementById("usageLocationAddress").value.trim() }; const action = found?.legacy || (!id && !oldName) ? "usage-location.add" : "usage-location.update"; try { await callMutate(action, payload); closeModal("usageLocationModal"); await loadState(); } catch(e) {} }
async function deleteUsageLocation(idOrName) { const found = STATE.usageLocations.find(l => String(l.id || l.name || l) === String(idOrName) || String(l.name || l) === String(idOrName)); if (!found || !confirm(`Xóa nơi sử dụng "${found.name || found}"? Chỉ xóa được khi không còn hàng tại đây.`)) return; try { await callMutate("usage-location.delete", { id: found.id || "", name: found.name || found }); await loadState(); } catch(e) {} }

// ----------------------------------------------------
// DANH MỤC (CATEGORIES)
// ----------------------------------------------------
function renderCategories() {
  const tbody = document.getElementById("categoryTableBody");
  if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";

  tbody.innerHTML = STATE.categories.map((cat, idx) => {
    const count = STATE.devices.filter(d => String(d.category).trim().toLowerCase() === String(cat).trim().toLowerCase()).reduce((sum, d) => sum + (Number(d.quantity) || 1), 0);
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><button type="button" class="link-button" data-act="entity-inventory" data-type="category" data-val="${escapeAttr(cat)}" title="Xem thiết bị thuộc danh mục này"><b>${escapeHtml(cat)}</b> ↗</button></td>
        <td><b>${escapeHtml(unitForCategory(cat))}</b></td>
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <button type="button" data-act="unit-cat" data-val="${cat}" style="cursor:pointer; margin-right:5px;">Đổi đơn vị</button>
            <button type="button" data-act="rename-cat" data-val="${cat}" style="cursor:pointer; margin-right:5px;">Đổi tên</button>
            <button type="button" data-act="del-cat" data-val="${cat}" style="color:red; cursor:pointer;">Xóa</button>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");
  applyTablePagination("categoryTableBody", "categories");
}

async function openAddCategoryModal() {
  const name = prompt("Nhập tên danh mục mới:");
  if (!name || !name.trim()) return;
  const unit = prompt("Đơn vị tính mặc định cho danh mục này:", defaultUnitForCategory(name.trim()));
  if (!unit || !unit.trim()) return;
  await callMutate("category.add", { name: name.trim(), unit: unit.trim() });
  await loadState();
}

async function editCategoryUnit(category) {
  const current = unitForCategory(category);
  const unit = prompt(`Đơn vị tính mặc định của danh mục "${category}":`, current);
  if (!unit || !unit.trim()) return;
  const result = await callMutate("category.unit.update", { name: category, unit: unit.trim() });
  if (result && result.error) return;
  await loadState();
}

async function renameCategory(oldName) {
  const newName = prompt(`Đổi tên danh mục "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  await callMutate("category.update", { oldName, newName: newName.trim() });
  await loadState();
}

async function deleteCategory(name) {
  if (!confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) return;
  await callMutate("category.delete", { name });
  await loadState();
}

// NẠP DỮ LIỆU SELECT DROPDOWN
function populateSelects() {
  const catOptions = STATE.categories.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
  const devCat = document.getElementById("devCategory"); if (devCat) devCat.innerHTML = catOptions;
  const filterCat = document.getElementById("filterCategory"); if (filterCat) filterCat.innerHTML = `<option value="">-- Tất cả danh mục --</option>` + catOptions;
  const locOptions = STATE.locations.map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join("");
  const devLoc = document.getElementById("devLocation"); if (devLoc) devLoc.innerHTML = locOptions;
  ["movToLocation","movFromLocation","bulkToLocation"].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = locOptions; });
  const usageOptions = STATE.usageLocations.map(l => `<option value="${escapeAttr(l.name || l)}">${escapeHtml(l.name || l)}</option>`).join("");
  ["movUsageLocation","movFromUsageLocation","bulkUsageLocation"].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = usageOptions; });
  const filterLoc = document.getElementById("filterLocation"); if (filterLoc) filterLoc.innerHTML = `<option value="">-- Tất cả vị trí & kho --</option>` + locOptions + usageOptions;
  const movDev = document.getElementById("movDeviceCode"); if (movDev) { movDev.innerHTML = STATE.devices.map(d => `<option value="${escapeAttr(d.code)}">${escapeHtml(d.code)} - ${escapeHtml(d.name || d.code)} (${escapeHtml(d.usageLocation || d.location || "Chưa gán")})</option>`).join(""); filterMovementDevices(); }
}

// ĐIỀU CHUYỂN HÀNG LOẠT
function openBulkMovementModal() {
  if (STATE.currentUser?.role !== "admin") return alert("Chỉ quản trị viên được lập phiếu hàng loạt.");
  const before = selectedCodes.size;
  selectedCodes = new Set([...selectedCodes].filter(code => {
    const d = STATE.devices.find(x => x.code === code);
    return d && d.trackingMode !== "quantity";
  }));
  const excluded = before - selectedCodes.size;
  showModalById("bulkMovementModal");
  const search = document.getElementById("bulkSearch"); if (search) search.value = "";
  const paste = document.getElementById("bulkCodesPaste"); if (paste) paste.value = "";
  const desc = document.getElementById("bulkModalDesc");
  if (desc) desc.innerText = `${selectedCodes.size} tài sản đã chọn sẵn. Tìm kiếm và chọn thêm; ${excluded ? `đã bỏ ${excluded} mã quản lý theo số lượng vì cần nhập số lượng riêng.` : ""}`;
  renderBulkPicker(); handleBulkTypeChange();
}

function getBulkFilteredDevices() {
  const q = (document.getElementById("bulkSearch")?.value || "").trim().toLowerCase();
  return STATE.devices.filter(d => d.trackingMode !== "quantity" && (!q || [d.code,d.name,d.model,d.serial,d.category,d.location,d.usageLocation,d.status].some(v => String(v || "").toLowerCase().includes(q))));
}
function renderBulkPicker() {
  const box = document.getElementById("bulkPickerResults"); if (!box) return;
  const filtered = getBulkFilteredDevices();
  box.innerHTML = filtered.slice(0, 500).map(d => `<label style="display:flex;gap:10px;align-items:flex-start;padding:8px;border-bottom:1px solid var(--border-color,#e5e7eb);cursor:pointer;"><input class="bulk-pick-check" type="checkbox" value="${escapeAttr(d.code)}" ${selectedCodes.has(d.code) ? "checked" : ""} style="margin-top:4px;"><span style="flex:1;min-width:0;"><b>${escapeHtml(d.code)} — ${escapeHtml(d.name || d.code)}</b><small style="display:block;color:var(--muted,#64748b);">${escapeHtml(d.category || "Chưa phân loại")} · ${escapeHtml(d.serial || "Không serial")} · ${escapeHtml(d.usageLocation || d.location || "Chưa rõ vị trí")}</small><small style="display:block;">${escapeHtml(d.status || "Chưa xác định")}</small></span></label>`).join("") || `<p class="muted" style="padding:12px;">Không có tài sản cá thể phù hợp.</p>`;
  if (filtered.length > 500) box.insertAdjacentHTML("beforeend", `<p class="muted" style="padding:8px;">Đang hiển thị 500/${filtered.length} kết quả đầu tiên. Hãy lọc hẹp hơn để chọn chính xác.</p>`);
  updateBulkPickerCount();
}
function updateBulkPickerCount() {
  const desc = document.getElementById("bulkModalDesc");
  if (desc) desc.innerText = `Đã chọn ${selectedCodes.size} tài sản có mã riêng. Mỗi phiếu tối đa 500 mã; có thể chọn từ menu Xuất / Nhập / Sự cố, tìm kiếm, dán mã hoặc quét QR.`;
}
function selectAllBulkFiltered(checked) {
  getBulkFilteredDevices().slice(0,500).forEach(d => checked ? selectedCodes.add(d.code) : selectedCodes.delete(d.code));
  renderBulkPicker(); updateFloatingBar();
}
function clearBulkSelection() { selectedCodes.clear(); renderBulkPicker(); updateFloatingBar(); }
function addPastedBulkCodes() {
  const raw = document.getElementById("bulkCodesPaste")?.value || "";
  const codes = raw.split(/[\s,;\t]+/).map(x => x.trim()).filter(Boolean);
  const found = [], missing = [];
  for (const code of codes) {
    const d = STATE.devices.find(x => x.code.toLowerCase() === code.toLowerCase());
    if (!d) missing.push(code); else if (d.trackingMode === "quantity") missing.push(`${code} (quản lý số lượng — cần phiếu riêng)`); else { selectedCodes.add(d.code); found.push(d.code); }
  }
  renderBulkPicker(); updateFloatingBar();
  alert(`Đã thêm ${found.length} mã.${missing.length ? ` Không thêm được ${missing.length} mã: ${missing.slice(0,15).join(", ")}${missing.length>15?"…":""}` : ""}`);
}
function handleBulkTypeChange() {
  const type = document.getElementById("bulkType")?.value || "Điều chuyển kho";
  const warehouseWrap = document.getElementById("bulkWarehouseWrap");
  const usageWrap = document.getElementById("bulkUsageWrap");
  const damageWrap = document.getElementById("bulkDamageSourceWrap");
  const needsWarehouse = ["Nhập kho", "Điều chuyển kho", "Báo hỏng / Đi bảo hành", "Thu hồi về kho", "Chuyển sang sửa chữa", "Báo thanh lý"].includes(type);
  const needsUsage = ["Xuất kho sử dụng", "Điều chuyển nơi sử dụng"].includes(type);
  if (warehouseWrap) warehouseWrap.classList.toggle("hidden", !needsWarehouse);
  if (usageWrap) usageWrap.classList.toggle("hidden", !needsUsage);
  if (damageWrap) damageWrap.classList.toggle("hidden", type !== "Báo hỏng / Đi bảo hành");
  const dest = document.getElementById("bulkToLocation"); if (dest) dest.required = needsWarehouse;
  const use = document.getElementById("bulkUsageLocation"); if (use) use.required = needsUsage;
  const defaultDamaged = STATE.locations.find(l => l.toLowerCase().includes("hỏng")) || STATE.locations[0] || "";
  if (type === "Báo hỏng / Đi bảo hành" && dest && defaultDamaged && !dest.value) dest.value = defaultDamaged;
}

async function handleSaveBulkMovement(e) {
  e?.preventDefault?.();
  const codes = Array.from(selectedCodes);
  if (!codes.length) return alert("Chưa chọn tài sản.");
  if (codes.length > 500) return alert("Mỗi phiếu tối đa 500 tài sản. Hãy chia thành nhiều phiếu.");
  const type = document.getElementById("bulkType")?.value;
  const toLocation = document.getElementById("bulkToLocation")?.value || "";
  const usageLocation = document.getElementById("bulkUsageLocation")?.value || "";
  const sourceMode = document.getElementById("bulkSourceMode")?.value || "warehouse";
  const note = (document.getElementById("bulkNote")?.value || "").trim();
  const department = (document.getElementById("bulkDepartment")?.value || "").trim();
  const recipient = (document.getElementById("bulkRecipient")?.value || "").trim();
  const referenceNo = (document.getElementById("bulkReferenceNo")?.value || "").trim();
  const summary = `Xác nhận ${type} cho ${codes.length} tài sản?\n${type.includes("nơi sử dụng") || type === "Xuất kho sử dụng" ? `Nơi sử dụng: ${usageLocation}` : `Kho đích: ${toLocation}`}\nNếu một mã không hợp lệ, toàn bộ phiếu sẽ bị từ chối.`;
  if (!confirm(summary)) return;
  try {
    await callMutate("movement.bulk_create", { codes, type, toLocation, usageLocation, sourceMode, note, department, recipient, referenceNo });
    closeModal("bulkMovementModal"); clearSelected(); await loadState();
    alert(`Đã ghi nhận phiếu ${type} cho ${codes.length} tài sản.`);
  } catch (err) { /* API trả lỗi, không đóng modal để người dùng sửa lựa chọn */ }
}

function filterMovementDevices() {
  const q = (document.getElementById("movDeviceSearch")?.value || "").trim().toLowerCase();
  const sel = document.getElementById("movDeviceCode"); if (!sel) return;
  const current = sel.value;
  const rows = STATE.devices.filter(d => !q || [d.code,d.name,d.model,d.serial,d.category,d.location,d.usageLocation].some(v => String(v || "").toLowerCase().includes(q)));
  sel.innerHTML = rows.map(d => `<option value="${escapeAttr(d.code)}">${escapeHtml(d.code)} - ${escapeHtml(d.name || d.code)} (${escapeHtml(d.usageLocation || d.location || "Chưa gán")})</option>`).join("");
  if (rows.some(d => d.code === current)) sel.value = current;
  handleSelectDeviceForMovement();
}

async function bulkDeleteDevices() {
  if (STATE.currentUser?.role !== "admin") return alert("Chỉ Admin mới được xóa tài sản/vật tư.");
  if (!selectedCodes.size) return alert("Chưa chọn tài sản/vật tư.");
  const withHistory = [...selectedCodes].filter(code => STATE.movements.some(m => String(m.deviceCode || "").toLowerCase() === String(code).toLowerCase()));
  if (withHistory.length) return alert(`Không thể xóa hàng loạt vì các mã sau đã có lịch sử: ${withHistory.slice(0, 10).join(", ")}${withHistory.length > 10 ? "…" : ""}. Không có mã nào bị xóa.`);
  if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedCodes.size} tài sản/vật tư đã chọn? Thao tác không thể hoàn tác.`)) return;
  await callMutate("device.delete", { codes: Array.from(selectedCodes) });
  clearSelected();
  await loadState();
}

// NHẬP CSV
function triggerImportCSV() {
  document.getElementById("csvFileInput")?.click();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    parseAndImportCSV(evt.target.result);
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
}

function parseCSVText(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ',') { row.push(field); field = ""; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = "";
      if (row.some(value => String(value).trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng.");
  if (field.length || row.length) { row.push(field); if (row.some(value => String(value).trim() !== "")) rows.push(row); }
  return rows;
}

async function parseAndImportCSV(csvText) {
  let parsed;
  try { parsed = parseCSVText(csvText); }
  catch (err) { return alert(err.message || "Không đọc được định dạng CSV."); }
  if (parsed.length < 2) return alert("File CSV rỗng hoặc thiếu tiêu đề.");
  const headers = parsed[0].map(v => String(v || "").trim().toLowerCase());
  const findCol = (candidates, fallback) => {
    const idx = headers.findIndex(h => candidates.some(c => h === c || h.includes(c)));
    return idx >= 0 ? idx : fallback;
  };
  // Ưu tiên tiêu đề chuẩn của file mẫu; vẫn hỗ trợ CSV cũ theo thứ tự cột.
  const col = {
    code: findCol(["mã quản lý", "mã thiết bị", "mã tài sản", "mã"], 0),
    name: findCol(["tên tài sản", "tên thiết bị", "tên vật tư", "tên"], 1),
    model: findCol(["hãng/model", "model/hãng", "quy cách", "model"], 2),
    serial: findCol(["serial", "mac", "sê-ri"], 3),
    category: findCol(["danh mục", "loại thiết bị"], 4),
    location: findCol(["vị trí", "kho lưu trữ", "kho"], 5),
    status: findCol(["tình trạng", "trạng thái"], 6),
    notes: findCol(["ghi chú", "mô tả"], 7),
    trackingMode: findCol(["cách quản lý", "tracking mode"], 8),
    quantity: findCol(["số lượng", "quantity"], 9),
    unit: findCol(["đơn vị", "đơn vị tính"], 10)
  };
  const items = [];
  for (let i = 1; i < parsed.length; i++) {
    const cols = parsed[i].map(v => String(v ?? "").trim());
    const get = key => cols[col[key]] || "";
    const code = get("code");
    if (!code) continue;
    const serial = get("serial");
    let quantityRaw = get("quantity").replace(/\s/g, "");
    if (quantityRaw.includes(",") && quantityRaw.includes(".")) quantityRaw = quantityRaw.replace(/,/g, "");
    else if (quantityRaw.includes(",")) quantityRaw = quantityRaw.replace(",", ".");
    const quantity = Number(quantityRaw || 1);
    if (!Number.isFinite(quantity) || quantity < 0) return alert(`Dòng ${i + 1}: số lượng không hợp lệ (${get("quantity")}).`);
    items.push({
      code,
      name: get("name") || code,
      model: get("model"),
      serial,
      category: get("category") || (STATE.categories[0] || "Khác"),
      location: get("location") || (STATE.locations[0] || "Kho kỹ thuật"),
      status: get("status") || "Trong kho",
      notes: get("notes"),
      trackingMode: get("trackingMode") || (serial ? "individual" : "quantity"),
      quantity,
      unit: get("unit") || "cái"
    });
  }
  if (items.length === 0) return alert("Không tìm thấy dòng dữ liệu có mã quản lý hợp lệ.");
  const codes = items.map(x => x.code.toLowerCase());
  const duplicates = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];
  if (duplicates.length) return alert(`File có mã bị trùng: ${duplicates.slice(0, 10).join(", ")}${duplicates.length > 10 ? "…" : ""}. Hãy sửa file trước khi nhập.`);
  if (!confirm(`Đã đọc ${items.length} dòng dữ liệu. Tiếp tục nạp vào hệ thống?\n\nLưu ý: kiểm tra mã trùng với dữ liệu đang có trước khi xác nhận.`)) return;
  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.innerText = "Đang nạp dữ liệu...";
  try {
    await callMutate("device.bulk_add", { items });
    alert(`Đã nạp thành công ${items.length} dòng dữ liệu.`);
    await loadState();
  } catch (err) {
    if (statusEl) statusEl.innerText = "Lỗi nhập dữ liệu";
  }
}
function downloadSampleCSV() {
  const headers = ["Mã quản lý", "Tên tài sản/vật tư", "Hãng/Model/Quy cách", "Serial/MAC", "Danh mục", "Vị trí", "Tình trạng", "Ghi chú", "Cách quản lý", "Số lượng", "Đơn vị"];
  const loc1 = STATE.locations[0] || "Kho kỹ thuật";
  const loc2 = STATE.locations.find(l => l !== loc1) || loc1;
  const cat1 = STATE.categories[0] || "Khác";
  const cat2 = STATE.categories.find(c => c !== cat1) || cat1;
  const rows = [headers,
    ["SW-TEST-0001", "Switch 24 port mẫu", "Cisco C9200", "SERIAL-MAU-001", cat1, loc1, "Trong kho", "Dòng mẫu — sửa/xóa trước khi nhập", "individual", 1, "cái"],
    ["CAP-TEST-0001", "Cáp mạng Cat6 mẫu", "Cat6", "", cat2, loc2, "Trong kho", "Dòng mẫu — sửa/xóa trước khi nhập", "quantity", 100, "mét"]
  ];
  downloadCSV("mau_nhap_thiet_bi.csv", rows);
}
// QUÉT QR
function openScannerModal() {
  showModalById("scannerModal");
  if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      closeScannerModal();
      const decoded = decodedText.trim();
      if (window._scanTarget === "serial") {
        const serialInput = document.getElementById("devSerial");
        if (serialInput) serialInput.value = decoded;
        window._scanTarget = null;
        return;
      }
      if (window._scanTarget === "bulk") {
        const d = STATE.devices.find(x => String(x.code).toLowerCase() === decoded.toLowerCase() || String(x.serial || "").toLowerCase() === decoded.toLowerCase());
        if (d && d.trackingMode !== "quantity") { selectedCodes.add(d.code); renderBulkPicker(); updateFloatingBar(); alert(`Đã chọn ${d.code}`); }
        else alert(d ? "Mã này quản lý theo số lượng; hãy lập phiếu vật tư riêng." : `Không tìm thấy mã/serial ${decoded}`);
        window._scanTarget = null;
        return;
      }
      handleScannedResult(decoded);
    },
    () => {}
  ).catch(err => {
    alert("Không thể khởi động camera: " + err);
    closeScannerModal();
  });
}

function closeScannerModal() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      closeModal("scannerModal");
    }).catch(() => {
      closeModal("scannerModal");
    });
  } else {
    closeModal("scannerModal");
  }
}

function handleScannedResult(code) {
  const cleanCode = String(code).trim().toLowerCase();
  const dev = STATE.devices.find(d => 
    String(d.code).trim().toLowerCase() === cleanCode || 
    (d.serial && String(d.serial).trim().toLowerCase() === cleanCode)
  );

  if (dev) {
    openMovementModal(dev.code);
  } else {
    if (confirm(`Mã [${code}] chưa có trong hệ thống. Bạn có muốn thêm mới thiết bị với mã này không?`)) {
      openDeviceModal(code);
    }
  }
}

async function callMutate(action, payload) {
  const token = localStorage.getItem("kho_token");
  const res = await fetch(`${API_BASE_URL}/api/mutate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ action, payload })
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data.error || `Thao tác thất bại (HTTP ${res.status})`;
    alert(message);
    throw new Error(message);
  }
  return data;
}

// BÁO CÁO CSV
function downloadCSV(filename, rows) {
  const processRow = function (row) {
    let finalVal = '';
    for (let j = 0; j < row.length; j++) {
      let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
      // Ngăn Excel diễn giải dữ liệu nhập từ người dùng thành công thức CSV.
      if (typeof row[j] === "string" && /^[\s]*[=+@\-\t\r]/.test(innerValue)) innerValue = "'" + innerValue;
      let result = innerValue.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) result = '"' + result + '"';
      if (j > 0) finalVal += ',';
      finalVal += result;
    }
    return finalVal + '\n';
  };

  let csvFile = '\uFEFF';
  for (let i = 0; i < rows.length; i++) csvFile += processRow(rows[i]);

  const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatQtyMap(map, unit) {
  return Object.entries(map || {}).filter(([, qty]) => Number(qty) > 0)
    .map(([location, qty]) => `${location}: ${Number(qty).toLocaleString("vi-VN")} ${unit || "cái"}`).join("; ");
}

// ----------------------------------------------------
// BÁO CÁO THEO ĐƠN VỊ / PHÒNG BAN / NGƯỜI ĐANG GIỮ
// ----------------------------------------------------
function custodyLocationInfo(location) {
  const key = String(location || "").trim().toLowerCase();
  return (STATE.usageLocations || []).find(item => String(item.name || item).trim().toLowerCase() === key) || null;
}

function latestCustodyMovement(device, usageLocation) {
  const code = String(device.code || "").trim().toLowerCase();
  const loc = String(usageLocation || "").trim().toLowerCase();
  return (STATE.movements || [])
    .filter(m => String(m.deviceCode || "").trim().toLowerCase() === code
      && !(m.cancelled || m.cancelledAt)
      && ["Xuất kho sử dụng", "Điều chuyển nơi sử dụng"].includes(String(m.type || ""))
      && String(m.usageLocation || m.toUsageLocation || "").trim().toLowerCase() === loc)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] || null;
}

function buildCustodyReportRows() {
  const rows = [];
  const pushRow = (d, location, status, quantity, holderOverride = "", departmentOverride = "") => {
    const info = custodyLocationInfo(location);
    const movement = status === "Đang sử dụng" ? latestCustodyMovement(d, location) : null;
    const department = String(departmentOverride || movement?.department || info?.department || "").trim() || "Chưa xác định";
    const holder = String(holderOverride || movement?.recipient || (status === "Đang sử dụng" ? info?.manager : "") || "").trim() || "Chưa xác định";
    rows.push({
      code: String(d.code || ""),
      name: String(d.name || d.code || ""),
      model: String(d.model || ""),
      serial: String(d.serial || ""),
      category: String(d.category || "Chưa phân loại"),
      status,
      location: String(location || "Chưa xác định"),
      department,
      holder,
      quantity: Math.max(0, Number(quantity) || 0),
      unit: String(d.unit || "cái"),
      trackingMode: d.trackingMode || "individual"
    });
  };

  for (const d of STATE.devices || []) {
    if (d.trackingMode !== "quantity") {
      const status = String(d.status || "Chưa xác định");
      const location = status === "Đang sử dụng" ? (d.usageLocation || d.location || "") : (d.location || d.usageLocation || "");
      const info = custodyLocationInfo(location);
      const movement = status === "Đang sử dụng" ? latestCustodyMovement(d, location) : null;
      const department = String(movement?.department || info?.department || "").trim() || "Chưa xác định";
      const holder = String(movement?.recipient || (status === "Đang sử dụng" ? info?.manager : "") || "").trim() || "Chưa xác định";
      pushRow(d, location, status, 1, holder, department);
      continue;
    }

    const groups = [
      ["stockByLocation", "Trong kho"],
      ["usageByLocation", "Đang sử dụng"],
      ["damagedByLocation", "Hỏng / Bảo hành"],
      ["usageDamagedByLocation", "Hỏng / Bảo hành"],
      ["repairByLocation", "Đang sửa chữa"],
      ["usageRepairByLocation", "Đang sửa chữa"],
      ["disposedByLocation", "Thanh lý"]
    ];
    for (const [mapName, status] of groups) {
      for (const [location, rawQty] of Object.entries(d[mapName] || {})) {
        const quantity = Number(rawQty) || 0;
        if (quantity <= 0) continue;
        pushRow(d, location, status, quantity);
      }
    }
    // Keep zero-stock SKU visible only if there is no location/status balance at all.
    if (!rows.some(r => r.code.toLowerCase() === String(d.code || "").toLowerCase())) {
      pushRow(d, d.location || "Chưa xác định", "Hết tồn", 0);
    }
  }
  return rows;
}

function getFilteredCustodyReportRows() {
  const q = String(document.getElementById("custodySearch")?.value || "").trim().toLowerCase();
  const department = document.getElementById("custodyDepartmentFilter")?.value || "";
  const holder = document.getElementById("custodyHolderFilter")?.value || "";
  const status = document.getElementById("custodyStatusFilter")?.value || "";
  return buildCustodyReportRows().filter(r => {
    const text = [r.code,r.name,r.model,r.serial,r.category,r.location,r.department,r.holder,r.status]
      .map(v => String(v || "").toLowerCase());
    return (!q || text.some(v => v.includes(q)))
      && (!department || r.department === department)
      && (!holder || r.holder === holder)
      && (!status || r.status === status);
  });
}

function refreshCustodyReportFilters(rows) {
  const update = (id, key, placeholder) => {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    const values = [...new Set(rows.map(r => r[key]).filter(Boolean))].sort((a,b) => a.localeCompare(b, "vi"));
    select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
    if (values.includes(current)) select.value = current;
  };
  update("custodyDepartmentFilter", "department", "Tất cả đơn vị/phòng ban");
  update("custodyHolderFilter", "holder", "Tất cả người giữ/phụ trách");
}

// ----------------------------------------------------
// LỊCH SỬ THEO TỪNG TÀI SẢN + KIỂM KÊ THỰC TẾ
// ----------------------------------------------------
const stocktakeDraft = (() => { try { return JSON.parse(localStorage.getItem("khoStocktakeDraftV529") || "{}"); } catch (_) { return Object.create(null); } })();
function persistStocktakeDraft() { try { localStorage.setItem("khoStocktakeDraftV529", JSON.stringify(stocktakeDraft)); } catch (_) {} }
function currentBookQuantity(d) {
  if (d.trackingMode !== "quantity") return /Thanh lý/i.test(d.status || "") ? 0 : 1;
  return Math.max(0, sumQtyMap(d.stockByLocation) + sumQtyMap(d.usageByLocation) + sumQtyMap(d.damagedByLocation) + sumQtyMap(d.usageDamagedByLocation) + sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation));
}
function openDeviceHistory(code) {
  const d=(STATE.devices||[]).find(x=>String(x.code)===String(code));
  const panel=document.getElementById("deviceHistoryPanel"); if(!panel) return;
  if(!d) { alert("Không tìm thấy tài sản/vật tư."); return; }
  const rows=(STATE.movements||[]).filter(m=>String(m.deviceCode||"").toLowerCase()===String(code).toLowerCase()).sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
  panel.innerHTML=`<div class="toolbar"><div><h2>Lịch sử tài sản: ${escapeHtml(d.code||code)} — ${escapeHtml(d.name||"")}</h2><p class="muted">Danh mục: ${escapeHtml(d.category||"—")} · Tình trạng hiện tại: ${escapeHtml(displayDeviceStatus(d))} · Số lượng hiện tại: ${currentBookQuantity(d).toLocaleString("vi-VN")} ${escapeHtml(d.unit||"cái")}</p></div><button type="button" class="secondary" data-act="device-history-close">Đóng</button></div>
  <div class="table-card"><table class="table"><thead><tr><th>Thời gian</th><th>Nghiệp vụ</th><th>Từ vị trí</th><th>Đến vị trí</th><th>Số lượng</th><th>Người nhận / đơn vị</th><th>Người thực hiện</th><th>Trạng thái</th><th>Ghi chú / phiếu</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${m.createdAt?new Date(m.createdAt).toLocaleString("vi-VN"):"—"}</td><td>${escapeHtml(m.type||"Giao dịch")}</td><td>${escapeHtml(m.fromLocation||m.fromUsageLocation||"—")}</td><td>${escapeHtml(m.toLocation||m.usageLocation||"—")}</td><td>${Number(m.quantity||1).toLocaleString("vi-VN")} ${escapeHtml(m.unit||d.unit||"cái")}</td><td>${escapeHtml([m.recipient,m.department].filter(Boolean).join(" · ")||"—")}</td><td>${escapeHtml(m.createdBy||"—")}</td><td>${m.cancelled||m.cancelledAt?"Đã hủy":"Có hiệu lực"}</td><td>${escapeHtml([m.referenceNo,m.note,m.cancelReason].filter(Boolean).join(" · ")||"—")}</td></tr>`).join("")||`<tr><td colspan="9" class="muted">Chưa có lịch sử giao dịch được ghi nhận cho mã này.</td></tr>`}</tbody></table></div>`;
  panel.classList.remove("hidden"); panel.scrollIntoView({behavior:"smooth",block:"start"});
}
function setStocktakeCount(code, value, rerender=true) {
  stocktakeDraft[code]=stocktakeDraft[code]||{};
  if(value==="" || value===null || value===undefined) delete stocktakeDraft[code].actual;
  else { const n=Number(value); if(Number.isFinite(n)&&n>=0) stocktakeDraft[code].actual=n; }
  if(!Object.keys(stocktakeDraft[code]).length) delete stocktakeDraft[code];
  persistStocktakeDraft();
  if(rerender) renderStocktake();
}
function setStocktakeNote(code, value, rerender=true) {
  stocktakeDraft[code]=stocktakeDraft[code]||{}; stocktakeDraft[code].note=String(value||"");
  persistStocktakeDraft();
  if(rerender) renderStocktake();
}
function renderStocktake() {
  const body=document.getElementById("stocktakeBody"); if(!body) return;
  const q=String(document.getElementById("stocktakeSearch")?.value||"").trim().toLowerCase();
  const mode=document.getElementById("stocktakeDiffFilter")?.value||"all";
  const rows=(STATE.devices||[]).map(d=>({d,expected:currentBookQuantity(d),draft:stocktakeDraft[d.code]||{}})).filter(r=>!q||[r.d.code,r.d.name,r.d.category,r.d.model,r.d.serial,r.d.location,r.d.usageLocation].some(v=>String(v||"").toLowerCase().includes(q))).filter(r=>mode==="missing"?r.draft.actual===undefined:mode==="diff"?r.draft.actual!==undefined&&Number(r.draft.actual)!==r.expected:true);
  body.innerHTML=rows.map(({d,expected,draft})=>{const actual=draft.actual;const diff=actual===undefined?null:Number(actual)-expected;const loc=d.trackingMode==="quantity"?[...Object.entries(d.stockByLocation||{}).filter(([,n])=>Number(n)>0).map(([k])=>k),...Object.entries(d.usageByLocation||{}).filter(([,n])=>Number(n)>0).map(([k])=>k)].join(", "):d.usageLocation||d.location||"—";return `<tr><td><b>${escapeHtml(d.code||"")}</b></td><td>${escapeHtml(d.name||d.code||"")}<small class="muted" style="display:block">${escapeHtml(d.category||"")}</small></td><td>${escapeHtml(loc||"—")}</td><td>${expected.toLocaleString("vi-VN")} ${escapeHtml(d.unit||"cái")}</td><td><input type="number" min="0" step="any" data-stocktake-code="${escapeAttr(d.code)}" data-stocktake-qty value="${actual===undefined?"":escapeAttr(actual)}" placeholder="Nhập thực tế" style="width:130px"></td><td>${diff===null?"Chưa kiểm":`<b style="color:${diff===0?'#15803d':'#b91c1c'}">${diff>0?'+':''}${diff.toLocaleString("vi-VN")}</b>`}</td><td><input type="text" data-stocktake-code="${escapeAttr(d.code)}" data-stocktake-note value="${escapeAttr(draft.note||"")}" placeholder="Ghi chú" style="min-width:150px"></td></tr>`;}).join("")||`<tr><td colspan="7" class="muted">Không có tài sản phù hợp.</td></tr>`;
  updateStocktakeSummary();
}
function updateStocktakeSummary() {
  const el=document.getElementById("stocktakeSummary"); if(!el) return;
  const all=STATE.devices||[]; const counted=all.filter(d=>stocktakeDraft[d.code]?.actual!==undefined); const diffs=counted.filter(d=>Number(stocktakeDraft[d.code].actual)!==currentBookQuantity(d));
  el.textContent=`Đã kiểm ${counted.length}/${all.length} mã · Chênh lệch ${diffs.length} mã`;
}
function resetStocktake() {
  if(!confirm("Xóa toàn bộ số lượng kiểm đếm và ghi chú của phiên kiểm kê trên trình duyệt này? Dữ liệu tồn kho hệ thống không bị thay đổi.")) return;
  Object.keys(stocktakeDraft).forEach(k=>delete stocktakeDraft[k]); persistStocktakeDraft(); renderStocktake();
}
function exportStocktakeCSV() {
  const rows=(STATE.devices||[]).map(d=>{const draft=stocktakeDraft[d.code]||{};const expected=currentBookQuantity(d);const actual=draft.actual;return {d,expected,actual,diff:actual===undefined?"":Number(actual)-expected,note:draft.note||""};});
  const data=[["Biên bản kiểm kê","Quản lý tài sản/vật tư"],["Ngày xuất",new Date().toLocaleString("vi-VN")],[],["Mã","Tên","Danh mục","Vị trí","Số lượng hệ thống","Số lượng thực tế","Chênh lệch","Đơn vị","Ghi chú","Trạng thái kiểm kê"],...rows.map(({d,expected,actual,diff,note})=>[d.code||"",d.name||"",d.category||"",d.usageLocation||d.location||"",expected,actual===undefined?"":actual,diff,d.unit||"cái",note,actual===undefined?"Chưa kiểm":Number(diff)===0?"Khớp":"Chênh lệch"] )];
  downloadCSV(`bien_ban_kiem_ke_${new Date().toISOString().slice(0,10)}.csv`,data);
}

function renderCustodyReport() {
  const body = document.getElementById("custodyReportBody");
  if (!body) return;
  const allRows = buildCustodyReportRows();
  refreshCustodyReportFilters(allRows);
  const rows = getFilteredCustodyReportRows();
  const fmt = value => Number(value || 0).toLocaleString("vi-VN");
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = fmt(value); };
  set("custodyKpiRows", rows.length);
  set("custodyKpiUsage", rows.filter(r => r.status === "Đang sử dụng").reduce((n,r) => n + r.quantity, 0));
  set("custodyKpiNoHolder", rows.filter(r => r.status === "Đang sử dụng" && r.holder === "Chưa xác định").length);
  set("custodyKpiDepartments", new Set(rows.map(r => r.department).filter(d => d !== "Chưa xác định")).size);

  body.innerHTML = rows.map(r => `<tr>
    <td><strong>${escapeHtml(r.code || "—")}</strong></td>
    <td><div><strong>${escapeHtml(r.name || "—")}</strong></div>${r.serial ? `<small class="muted">${escapeHtml(r.serial)}</small>` : (r.model ? `<small class="muted">${escapeHtml(r.model)}</small>` : "")}</td>
    <td>${escapeHtml(r.category)}</td>
    <td><span class="badge ${r.status === "Hỏng / Bảo hành" || r.status === "Thanh lý" ? "badge-danger" : r.status === "Đang sử dụng" ? "badge-secondary" : r.status === "Đang sửa chữa" ? "badge-danger" : "badge-primary"}">${escapeHtml(r.status)}</span></td>
    <td>${escapeHtml(r.location)}</td>
    <td>${escapeHtml(r.department)}</td>
    <td>${escapeHtml(r.holder)}</td>
    <td><strong>${fmt(r.quantity)}</strong></td>
    <td>${escapeHtml(r.unit)}</td>
  </tr>`).join("") || `<tr><td colspan="9" class="muted empty-state">Không có tài sản/vật tư phù hợp với bộ lọc.</td></tr>`;
  const count = document.getElementById("custodyReportCount");
  if (count) count.textContent = `Hiển thị ${rows.length.toLocaleString("vi-VN")} / ${allRows.length.toLocaleString("vi-VN")} dòng báo cáo`;
  const deptBody = document.getElementById("custodyDepartmentBody");
  if (deptBody) {
    const grouped = new Map();
    rows.forEach(r => {
      const key = r.department || "Chưa xác định";
      if (!grouped.has(key)) grouped.set(key, { department:key, codes:new Set(), quantity:0, usage:0, exception:0 });
      const g = grouped.get(key);
      g.codes.add(r.code);
      g.quantity += r.quantity;
      if (r.status === "Đang sử dụng") g.usage += r.quantity;
      if (["Hỏng / Bảo hành","Đang sửa chữa","Thanh lý"].includes(r.status)) g.exception += r.quantity;
    });
    deptBody.innerHTML = [...grouped.values()].sort((a,b) => b.quantity - a.quantity).map(g => `<tr>
      <td><strong>${escapeHtml(g.department)}</strong></td><td>${fmt(g.codes.size)}</td><td>${fmt(g.quantity)}</td><td>${fmt(g.usage)}</td><td>${fmt(g.exception)}</td>
    </tr>`).join("") || `<tr><td colspan="5" class="muted empty-state">Không có dữ liệu tổng hợp.</td></tr>`;
  }
  applyTablePagination("custodyReportBody", "custodyReport");
  applyTablePagination("custodyDepartmentBody", "custodyDepartment");
}

function resetCustodyReportFilters() {
  ["custodySearch","custodyDepartmentFilter","custodyHolderFilter","custodyStatusFilter"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  renderCustodyReport();
}

function exportCustodyReportCSV() {
  const rows = getFilteredCustodyReportRows();
  const csv = [["Mã tài sản/vật tư","Tên","Model","Serial/MAC","Danh mục","Tình trạng","Vị trí hiện tại","Đơn vị/phòng ban","Người giữ/phụ trách","Số lượng","Đơn vị tính"],
    ...rows.map(r => [r.code,r.name,r.model,r.serial,r.category,r.status,r.location,r.department,r.holder,r.quantity,r.unit])];
  downloadCSV(`bao_cao_tai_san_theo_don_vi_nguoi_giu_${new Date().toISOString().slice(0,10)}.csv`, csv);
}

function exportDevicesCSV() {
  const headers = ["Mã quản lý", "Tên tài sản/vật tư", "Hãng/Model/Quy cách", "Serial/MAC", "Danh mục", "Cách quản lý", "Số lượng hoạt động", "Đơn vị", "Vị trí chính", "Tồn kho theo kho", "Đang sử dụng theo nơi", "Hỏng/bảo hành theo vị trí", "Sửa chữa theo vị trí", "Thanh lý theo kho", "Tình trạng", "Ghi chú"];
  const rows = [headers];
  STATE.devices.forEach(d => {
    const individualLocation = d.usageLocation || d.location || "";
    rows.push([
      d.code || "", d.name || "", d.model || "", d.serial || "", d.category || "",
      d.trackingMode || "individual", d.quantity ?? 1, d.unit || "cái", individualLocation,
      formatQtyMap(d.stockByLocation, d.unit),
      formatQtyMap(d.usageByLocation, d.unit),
      [formatQtyMap(d.damagedByLocation, d.unit), formatQtyMap(d.usageDamagedByLocation, d.unit)].filter(Boolean).join("; "),
      [formatQtyMap(d.repairByLocation, d.unit), formatQtyMap(d.usageRepairByLocation, d.unit)].filter(Boolean).join("; "),
      formatQtyMap(d.disposedByLocation, d.unit), displayDeviceStatus(d), d.notes || ""
    ]);
  });
  downloadCSV(`danh_sach_thiet_bi_${new Date().toISOString().slice(0,10)}.csv`, rows);
}
function exportMovementsCSV() {
  exportMovementRowsCSV(getFilteredMovements(), "lich_su_dieu_chuyen_da_loc");
}
function exportAllMovementsCSV() {
  exportMovementRowsCSV(STATE.movements || [], "lich_su_dieu_chuyen_toan_bo");
}
function exportMovementRowsCSV(movements, prefix) {
  const headers = ["Thời gian", "Mã thiết bị", "Loại giao dịch", "Từ kho", "Từ nơi sử dụng", "Đến kho", "Đến nơi sử dụng", "Số lượng", "Đơn vị", "Đơn vị nhận", "Người nhận", "Số phiếu/công trình", "Lý do/Ghi chú", "Người thực hiện", "Trạng thái phiếu", "Lý do hủy"];
  const rows = [headers];
  movements.forEach(m => {
    rows.push([m.createdAt || "", m.deviceCode, m.type, m.fromLocation || "", m.fromUsageLocation || "", m.toLocation || "", m.usageLocation || "", m.quantity ?? 1, m.unit || "cái", m.department || "", m.recipient || "", m.referenceNo || "", m.note || "", m.createdBy || "", (m.cancelled || m.cancelledAt) ? "Đã hủy" : "Hoàn tất", m.cancelReason || ""]);
  });
  downloadCSV(`${prefix}_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

// USER
async function loadUsers() {
  const token = localStorage.getItem("kho_token");
  try {
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById("userTableBody");
    if (!tbody) return;

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><b>${u.username}</b></td>
        <td>${u.displayName || ""}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-secondary'}">${u.role === 'admin' ? 'Quản trị viên' : 'Chỉ xem (Viewer)'}</span></td>
        <td style="text-align:right;">
          ${u.username.toLowerCase() !== 'admin' ? `
            <button type="button" onclick="deleteUser('${u.username}')" style="color:red; cursor:pointer;">Xóa</button>
          ` : '<small class="muted">Tài khoản chính</small>'}
        </td>
      </tr>
    `).join("");
    applyTablePagination("userTableBody", "users");
  } catch (e) {
    console.error("Lỗi nạp users:", e);
  }
}

function openUserModal() {
  showModalById("userModal");
  const u = document.getElementById("usrUsername"); if (u) { u.value = ""; u.readOnly = false; }
  const p = document.getElementById("usrPassword"); if (p) p.value = "";
  const d = document.getElementById("usrDisplayName"); if (d) d.value = "";
  const r = document.getElementById("usrRole"); if (r) r.value = "viewer";
}

async function handleSaveUser(e) {
  e.preventDefault();
  const username = (document.getElementById("usrUsername")?.value || "").trim();
  const password = document.getElementById("usrPassword")?.value || "";
  const displayName = (document.getElementById("usrDisplayName")?.value || "").trim();
  const role = document.getElementById("usrRole")?.value || "viewer";

  const token = localStorage.getItem("kho_token");
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      action: "add",
      user: { username, password, displayName, role }
    })
  });

  const data = await res.json();
  if (res.ok) {
    alert("Lưu thông tin người dùng thành công!");
    closeModal("userModal");
    loadUsers();
  } else {
    alert("Lỗi: " + (data.error || "Không thể lưu"));
  }
}

async function deleteUser(username) {
  if (!confirm(`Bạn có chắc muốn xóa [${username}]?`)) return;
  const token = localStorage.getItem("kho_token");
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ action: "delete", username })
  });

  const data = await res.json();
  if (res.ok) {
    alert("Đã xóa người dùng!");
    loadUsers();
  } else {
    alert("Lỗi: " + (data.error || "Không thể xóa"));
  }
}
document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-dashboard-alert]");
  if (button) openDashboardAlert(button.dataset.dashboardAlert);
});
