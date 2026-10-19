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

  if (act === "edit-dev") {
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
  } else if (act === "dashboard-location-close") {
    const detail = document.getElementById("dashboardLocationDetail");
    if (detail) { detail.classList.add("hidden"); detail.innerHTML = ""; }
  }
});

// LẮNG NGHE SỰ KIỆN CHỌN CHECKBOX THIẾT BỊ
document.addEventListener("change", (e) => {
  const chk = e.target.closest("input.dev-check");
  if (chk) toggleSelectDevice(chk.value, chk.checked);
  const bulkChk = e.target.closest("input.bulk-pick-check");
  if (bulkChk) {
    if (bulkChk.checked) selectedCodes.add(bulkChk.value); else selectedCodes.delete(bulkChk.value);
    updateBulkPickerCount(); updateFloatingBar();
  }
});

document.addEventListener("DOMContentLoaded", () => {
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

function showView(viewId) {
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

  const titles = {
    dashboard: "Tổng quan",
    devices: "Danh sách tài sản & vật tư",
    locations: "Kho lưu trữ",
    usageLocations: "Nơi sử dụng",
    categories: "Danh mục thiết bị",
    movements: "Lịch sử điều chuyển & sự cố",
    reports: "Báo cáo & Nhập Excel",
    users: "Quản trị người dùng"
  };
  const titleEl = document.getElementById("pageTitle");
  if (titleEl) titleEl.innerText = titles[viewId] || "Kho";

  if (viewId === "users") loadUsers();
  if (viewId === "categories") renderCategories();
  if (viewId === "locations") renderLocations();
  if (viewId === "usageLocations") renderUsageLocations();
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
    renderCategories();
    renderLocations();
    renderUsageLocations();

    if (statusEl) statusEl.innerText = "Đã đồng bộ";
  } catch (err) {
    if (statusEl) statusEl.innerText = "Lỗi kết nối";
  }
}

function sumQtyMap(map) { return Object.values(map || {}).reduce((sum, n) => sum + (Number(n) || 0), 0); }
function deviceStockQuantity(d) { return d.trackingMode === "quantity" ? sumQtyMap(d.stockByLocation) : (d.status === "Trong kho" ? 1 : 0); }
function deviceUsageQuantity(d) { return d.trackingMode === "quantity" ? sumQtyMap(d.usageByLocation) : (d.status === "Đang sử dụng" ? 1 : 0); }
function deviceDamagedQuantity(d) { return d.trackingMode === "quantity" ? sumQtyMap(d.damagedByLocation) + sumQtyMap(d.usageDamagedByLocation) + sumQtyMap(d.repairByLocation) + sumQtyMap(d.usageRepairByLocation) : (/Hỏng|Bảo hành|Đang sửa chữa/i.test(d.status || "") ? 1 : 0); }
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
}

function getDeviceQuantityAtLocation(device, location) {
  const qty = Number(device.quantity);
  if (device.trackingMode === "quantity") {
    return Math.max(0, Number((device.stockByLocation || {})[location] || 0) + Number((device.damagedByLocation || {})[location] || 0) + Number((device.usageByLocation || {})[location] || 0) + Number((device.usageDamagedByLocation || {})[location] || 0) + Number((device.usageRepairByLocation || {})[location] || 0));
  }
  const same = String(device.location || "").trim().toLowerCase() === String(location || "").trim().toLowerCase();
  return same ? (Number.isFinite(qty) && qty > 0 ? qty : 1) : 0;
}

function getWarehouseQuantityAtLocation(device, location) {
  if (device.trackingMode === "quantity") return Math.max(0, Number((device.stockByLocation || {})[location] || 0) + Number((device.damagedByLocation || {})[location] || 0) + Number((device.repairByLocation || {})[location] || 0));
  if (device.status === "Đang sử dụng" || device.status === "Thanh lý") return 0;
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
    const damaged = records.reduce((sum, d) => sum + (d.trackingMode === "quantity" ? Number((d.damagedByLocation || {})[loc] || 0) + Number((d.repairByLocation || {})[loc] || 0) : (/Hỏng|Bảo hành|Đang sửa chữa/i.test(d.status || "") ? getWarehouseQuantityAtLocation(d, loc) : 0)), 0);
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
function getFilteredDevices() {
  const q = (document.getElementById("deviceSearch")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("filterCategory")?.value || "";
  const loc = document.getElementById("filterLocation")?.value || "";

  return STATE.devices.filter(d => {
    const matchQ = !q || (
      (d.code || "").toLowerCase().includes(q) ||
      (d.name || "").toLowerCase().includes(q) ||
      (d.model || "").toLowerCase().includes(q) ||
      (d.serial || "").toLowerCase().includes(q)
    );
    const matchCat = !cat || d.category === cat;
    const matchLoc = !loc || getDeviceQuantityAtLocation(d, loc) > 0;
    return matchQ && matchCat && matchLoc;
  });
}

function resetFilters() {
  const q = document.getElementById("deviceSearch"); if (q) q.value = "";
  const cat = document.getElementById("filterCategory"); if (cat) cat.value = "";
  const loc = document.getElementById("filterLocation"); if (loc) loc.value = "";
  renderDevices();
}

function renderDevices() {
  const filtered = getFilteredDevices();
  const tbody = document.getElementById("deviceTableBody");
  const countEl = document.getElementById("filterResultCount");
  const isAdmin = STATE.currentUser?.role === "admin";

  if (countEl) countEl.innerText = `Đang hiển thị ${filtered.length} / ${STATE.devices.length} thiết bị`;
  if (!tbody) return;

  tbody.innerHTML = filtered.map(d => {
    const isChecked = selectedCodes.has(d.code);
    return `
      <tr>
        ${isAdmin ? `
          <td>
            <input type="checkbox" class="dev-check" value="${d.code}" ${isChecked ? 'checked' : ''}>
          </td>` : `<td></td>`}
        <td><b>${d.code}</b></td>
        <td>
          <div><b>${d.name || d.code}</b></div>
          ${d.notes ? `<small class="muted" style="display:block; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.notes}</small>` : ''}
        </td>
        <td>${d.model || "-"}</td>
        <td><code>${d.serial || "-"}</code></td>
        <td>${d.category || ""}</td>
        <td><b>${d.trackingMode === "quantity" ? [...Object.entries(d.stockByLocation || {}).filter(([loc, qty]) => Number(qty) > 0).map(([loc, qty]) => `${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`), ...Object.entries(d.usageByLocation || {}).filter(([loc, qty]) => Number(qty) > 0).map(([loc, qty]) => `Đang dùng - ${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`), ...Object.entries(d.damagedByLocation || {}).filter(([loc, qty]) => Number(qty) > 0).map(([loc, qty]) => `Hỏng tại ${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`), ...Object.entries(d.usageDamagedByLocation || {}).filter(([loc, qty]) => Number(qty) > 0).map(([loc, qty]) => `Hỏng tại nơi dùng ${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`), ...Object.entries(d.repairByLocation || {}).filter(([loc, qty]) => Number(qty) > 0).map(([loc, qty]) => `Đang sửa tại ${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`), ...Object.entries(d.usageRepairByLocation || {}).filter(([loc, qty]) => Number(qty) > 0).map(([loc, qty]) => `Đang sửa tại nơi dùng ${loc}: ${Number(qty).toLocaleString("vi-VN")} ${d.unit || "cái"}`)].join("; ") || (d.location || "-") : (d.usageLocation || d.location || "-")}</b></td>
        <td><b>${d.trackingMode === "quantity" ? Number(d.quantity || 0).toLocaleString("vi-VN") : "1"} ${d.unit || "cái"}</b></td>
        <td>
          <span class="badge ${
            d.status === 'Trong kho' ? 'badge-primary' : 
            (d.status === 'Đang sử dụng' ? 'badge-secondary' : 'badge-danger')
          }">${escapeHtml(displayDeviceStatus(d))}</span>
        </td>
        ${isAdmin ? `
          <td style="text-align:right; white-space:nowrap;">
            <button type="button" data-act="quick-mov" data-val="${d.code}" style="background:#2563eb; color:#fff; cursor:pointer; margin-right:4px;">Chuyển/Báo hỏng</button>
            <button type="button" data-act="edit-dev" data-val="${d.code}" style="cursor:pointer; margin-right:4px;">Sửa</button>
            <button type="button" data-act="del-dev" data-val="${d.code}" style="color:red; cursor:pointer;">Xóa</button>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");

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
  if (!confirm(`Bạn có chắc chắn muốn xóa thiết bị [${code}]?`)) return;
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
  const sourceType = sourceTypeEl?.value || "warehouse";
  const needsSourceChoice = isDamage || isDispose;
  document.getElementById("movDamageSourceWrap")?.classList.toggle("hidden", !needsSourceChoice);
  const showFromW = !isIn && !isReturn && !isUseTransfer && (!needsSourceChoice || sourceType === "warehouse");
  const showFromU = isReturn || isUseTransfer || (needsSourceChoice && sourceType === "usage");
  const showToW = isIn || isTransfer || isReturn || isDamage || isRepair || isSendRepair;
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
    const map = isRepair ? (Number((dev.repairByLocation || {})[fw?.value] || 0) > 0 ? dev.repairByLocation : (dev.damagedByLocation || {})) : isSendRepair ? (dev.damagedByLocation || {}) : (dev.stockByLocation || {});
    const opts = STATE.locations.filter(l => Number(map[l] || 0) > 0);
    if (fw) { const previous = fw.value; fw.innerHTML = (opts.length ? opts : STATE.locations).map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}${opts.length ? ` — ${isRepair ? "đang sửa/hỏng" : isSendRepair ? "hàng hỏng" : "còn"} ${Number(map[l] || 0).toLocaleString("vi-VN")} ${escapeHtml(dev.unit || "cái")}` : ""}</option>`).join(""); if (opts.includes(previous)) fw.value = previous; }
  }
  if ((isIn || isTransfer || isReturn || isRepair) && to && !to.value) setElementValueSafe("movToLocation", STATE.locations[0] || "", true);
  if (isUseTransfer) { const targetUse = document.getElementById("movUsageLocation"); const sourceUse = document.getElementById("movFromUsageLocation")?.value; const alternative = STATE.usageLocations.map(l => l.name || l).find(l => l !== sourceUse); if (targetUse && alternative && targetUse.value === sourceUse) targetUse.value = alternative; }
  const note = document.getElementById("movNote"); if (note) note.placeholder = isIn ? "Nguồn nhập, số hóa đơn/biên bản..." : isUseOut ? "Mục đích cấp phát, công trình..." : isDamage ? "Mô tả hư hỏng..." : "Ghi chú / lý do giao dịch...";
  const label = document.getElementById("movAvailableQty");
  if (label && dev?.trackingMode === "quantity") { const source = (isReturn || isUseTransfer || (needsSourceChoice && sourceType === "usage")) ? Number((dev.usageByLocation || {})[fu?.value] || 0) : (isRepair ? Number(((Number((dev.repairByLocation || {})[fw?.value] || 0) > 0 ? dev.repairByLocation : dev.damagedByLocation) || {})[fw?.value] || 0) : isSendRepair ? Number((dev.damagedByLocation || {})[fw?.value] || 0) : Number((dev.stockByLocation || {})[fw?.value] || 0)); label.textContent = `Số dư nguồn hiện tại: ${source.toLocaleString("vi-VN")} ${dev.unit || "cái"}`; } else if (label) label.textContent = "";
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
  const payload = { deviceCode, type, fromLocation: (isIn || isReturn || isUseTransfer || sourceUsage) ? "" : fromLocation, toLocation: (isUseOut || isUseTransfer || isDispose) ? "" : toLocation, usageLocation: (isUseOut || isUseTransfer) ? usageLocation : "", fromUsageLocation: sourceUsage, quantity, department: document.getElementById("movDepartment")?.value.trim() || "", recipient: document.getElementById("movRecipient")?.value.trim() || "", referenceNo: document.getElementById("movReferenceNo")?.value.trim() || "", note: document.getElementById("movNote")?.value.trim() || "" };
  try { await callMutate("movement.create", payload); closeModal("movementModal"); await loadState(); } catch (err) { /* server validation already shown */ }
}

function renderMovements() {
  const tbody = document.getElementById("movementTableBody");
  if (!tbody) return;
  tbody.innerHTML = STATE.movements.map(m => `
    <tr>
      <td>${m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "-"}</td>
      <td><b>${m.deviceCode}</b></td>
      <td><span class="badge ${m.type.includes('hỏng') || m.type.includes('thanh lý') ? 'badge-danger' : 'badge-secondary'}">${m.type}</span></td>
      <td>${escapeHtml(m.fromLocation || m.fromUsageLocation || "-")}</td>
      <td><b>${escapeHtml(m.toLocation || m.usageLocation || "-")}</b></td>
      <td><small>${Number(m.quantity || 1).toLocaleString("vi-VN")} ${escapeHtml(m.unit || "cái")}${m.department ? ` · ${escapeHtml(m.department)}` : ""}${m.recipient ? ` · Người nhận: ${escapeHtml(m.recipient)}` : ""}${m.referenceNo ? ` · Phiếu: ${escapeHtml(m.referenceNo)}` : ""}${m.note ? ` · ${escapeHtml(m.note)}` : ""}</small></td>
      <td>${m.createdBy || "-"}</td>
    </tr>
  `).join("");
}

// ----------------------------------------------------
// VỊ TRÍ & KHO (LOCATIONS)
// ----------------------------------------------------
function renderLocations() {
  const tbody = document.getElementById("locationTableBody"); if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";
  tbody.innerHTML = STATE.locations.map((loc, idx) => {
    const count = STATE.devices.reduce((sum, d) => sum + (d.trackingMode === "quantity" ? Number((d.stockByLocation || {})[loc] || 0) + Number((d.damagedByLocation || {})[loc] || 0) : (d.status !== "Đang sử dụng" && d.location === loc ? 1 : 0)), 0);
    return `<tr><td>${idx + 1}</td><td><b>${escapeHtml(loc)}</b></td><td><span class="badge badge-secondary">${count.toLocaleString("vi-VN")} đơn vị</span></td>${isAdmin ? `<td style="text-align:right;"><button type="button" data-act="rename-loc" data-val="${escapeAttr(loc)}">Đổi tên</button> <button type="button" data-act="del-loc" data-val="${escapeAttr(loc)}" style="color:red">Xóa</button></td>` : `<td></td>`}</tr>`;
  }).join("");
}
async function openAddLocationModal() { const name = prompt("Nhập tên kho lưu trữ mới:"); if (!name || !name.trim()) return; try { await callMutate("location.add", { name: name.trim() }); await loadState(); } catch(e) {} }
async function renameLocation(oldName) { const newName = prompt(`Đổi tên kho "${oldName}" thành:`, oldName); if (!newName || !newName.trim() || newName.trim() === oldName) return; try { await callMutate("location.update", { oldName, newName: newName.trim() }); await loadState(); } catch(e) {} }
async function deleteLocation(name) { if (!confirm(`Bạn có chắc muốn xóa kho "${name}"?`)) return; try { await callMutate("location.delete", { name }); await loadState(); } catch(e) {} }
function renderUsageLocations() {
  const tbody = document.getElementById("usageLocationTableBody"); if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";
  tbody.innerHTML = STATE.usageLocations.map((l, idx) => { const name = l.name || l; const qty = STATE.devices.reduce((sum,d) => sum + getDeviceUsageAtLocation(d,name),0); return `<tr><td>${idx+1}</td><td><b>${escapeHtml(name)}</b></td><td>${escapeHtml(l.department || "-")}</td><td>${escapeHtml(l.manager || "-")}</td><td>${escapeHtml(l.address || "-")}</td><td><span class="badge badge-secondary">${qty.toLocaleString("vi-VN")}</span></td><td>${isAdmin ? (l.legacy ? `<button type="button" data-act="edit-usage-loc" data-val="${escapeAttr(name)}">Khai báo</button>` : `<button type="button" data-act="edit-usage-loc" data-val="${escapeAttr(l.id || name)}">Sửa</button> <button type="button" data-act="del-usage-loc" data-val="${escapeAttr(l.id || name)}" style="color:#b91c1c">Xóa</button>`) : (l.legacy ? `<span class="badge badge-danger">Chưa chuẩn hóa</span>` : "")}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">Chưa có nơi sử dụng.</td></tr>`;
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
        <td><b>${cat}</b></td>
        <td><b>${unitForCategory(cat)}</b></td>
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
  if (desc) desc.innerText = `Đã chọn ${selectedCodes.size} tài sản cá thể. Mỗi phiếu tối đa 500 mã.`;
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
  const needsWarehouse = ["Điều chuyển kho", "Báo hỏng / Đi bảo hành", "Thu hồi về kho", "Chuyển sang sửa chữa"].includes(type);
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
  if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedCodes.size} thiết bị đã chọn?`)) return;
  await callMutate("device.delete", { codes: Array.from(selectedCodes) });
  clearSelected();
  loadState();
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

async function parseAndImportCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return alert("File CSV rỗng hoặc thiếu tiêu đề");

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"\$/g, ''));
    if (cols.length >= 2 && cols[0]) {
      items.push({
        code: cols[0],
        name: cols[1] || cols[0],
        model: cols[2] || "",
        serial: cols[3] || "",
        category: cols[4] || (STATE.categories[0] || "Khác"),
        location: cols[5] || (STATE.locations[0] || "Kho kỹ thuật"),
        status: cols[6] || "Trong kho",
        notes: cols[7] || "",
        trackingMode: cols[8] || (cols[3] ? "individual" : "quantity"),
        quantity: Number(cols[9] || 1),
        unit: cols[10] || "cái"
      });
    }
  }

  if (items.length === 0) return alert("Không tìm thấy dữ liệu hợp lệ trong file");

  if (!confirm(`Đã tìm thấy ${items.length} thiết bị từ file. Bắt đầu nạp vào hệ thống?`)) return;

  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.innerText = "Đang nạp dữ liệu...";
  await callMutate("device.bulk_add", { items });
  alert(`Đã nạp thành công thiết bị vào hệ thống!`);
  loadState();
}

function downloadSampleCSV() {
  const sample = "\uFEFFMã quản lý,Tên tài sản/vật tư,Hãng/Model/Quy cách,Serial/MAC,Danh mục,Vị trí,Tình trạng,Ghi chú,Cách quản lý,Số lượng,Đơn vị\nSW-0001,Switch 24 port,Cisco C9200,FOC111222,Switch mạng,Kho kỹ thuật,Trong kho,Thiết bị mẫu,individual,1,cái\nCAP-0001,Cáp mạng Cat6,Cat6 ngoài trời,,Cáp mạng,Kho vật tư,Trong kho,Cuộn 1000m,quantity,1000,mét\nDNQ-0001,Dây nhảy quang LC-FC,Single mode,,Dây nhảy quang,Kho vật tư,Trong kho,Đầu LC - FC,quantity,100,sợi";
  const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "mau_nhap_thiet_bi.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

function exportDevicesCSV() {
  const headers = ["Mã thiết bị", "Tên thiết bị", "Model/Hãng", "Serial/MAC", "Danh mục", "Vị trí", "Tình trạng", "Lịch sử & Ghi chú"];
  const rows = [headers];
  STATE.devices.forEach(d => {
    rows.push([d.code, d.name, d.model || "", d.serial || "", d.category, d.location || "", d.status, d.notes || "", d.trackingMode || "individual", d.quantity ?? 1, d.unit || "cái"]);
  });
  downloadCSV(`danh_sach_thiet_bi_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportMovementsCSV() {
  const headers = ["Thời gian", "Mã thiết bị", "Loại giao dịch", "Từ kho", "Từ nơi sử dụng", "Đến kho", "Đến nơi sử dụng", "Số lượng", "Đơn vị", "Đơn vị nhận", "Người nhận", "Số phiếu/công trình", "Lý do/Ghi chú", "Người thực hiện"];
  const rows = [headers];
  STATE.movements.forEach(m => {
    rows.push([m.createdAt || "", m.deviceCode, m.type, m.fromLocation || "", m.fromUsageLocation || "", m.toLocation || "", m.usageLocation || "", m.quantity ?? 1, m.unit || "cái", m.department || "", m.recipient || "", m.referenceNo || "", m.note || "", m.createdBy || ""]);
  });
  downloadCSV(`lich_su_dieu_chuyen_${new Date().toISOString().slice(0,10)}.csv`, rows);
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
