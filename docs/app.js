let STATE = {
  devices: [],
  movements: [],
  categories: [],
  locations: [],
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
  }
});

// LẮNG NGHE SỰ KIỆN CHỌN CHECKBOX THIẾT BỊ
document.addEventListener("change", (e) => {
  const chk = e.target.closest("input.dev-check");
  if (chk) {
    toggleSelectDevice(chk.value, chk.checked);
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
    locations: "Danh bạ Vị trí & Kho",
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
    STATE.locations = data.locations || [
      "Kho kỹ thuật - Tầng 1",
      "Kho thiết bị dự phòng",
      "Kho thanh lý / Chờ xử lý",
      "Tủ Rack Server - Trung tâm dữ liệu"
    ];

    renderDashboard();
    populateSelects();
    renderDevices();
    renderMovements();
    renderCategories();
    renderLocations();

    if (statusEl) statusEl.innerText = "Đã đồng bộ";
  } catch (err) {
    if (statusEl) statusEl.innerText = "Lỗi kết nối";
  }
}

function renderDashboard() {
  const total = document.getElementById("statTotalDevices");
  const qtyOf = d => Number.isFinite(Number(d.quantity)) && d.quantity !== "" ? Number(d.quantity) : 1;
  if (total) total.innerText = STATE.devices.reduce((sum, d) => sum + qtyOf(d), 0).toLocaleString("vi-VN");
  const inStock = document.getElementById("statInStock");
  if (inStock) inStock.innerText = STATE.devices.filter(d => d.status === "Trong kho").reduce((sum, d) => sum + qtyOf(d), 0).toLocaleString("vi-VN");
  const inUse = document.getElementById("statInUse");
  if (inUse) inUse.innerText = STATE.devices.filter(d => d.status === "Đang sử dụng").reduce((sum, d) => sum + qtyOf(d), 0).toLocaleString("vi-VN");
  const faulty = document.getElementById("statFaulty");
  if (faulty) faulty.innerText = STATE.devices.filter(d => (d.status || "").includes("Hỏng") || (d.status || "").includes("Thanh lý")).reduce((sum, d) => sum + qtyOf(d), 0).toLocaleString("vi-VN");
}

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
    const matchLoc = !loc || d.location === loc;
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
        <td><b>${d.trackingMode === "quantity" && d.stockByLocation ? Object.entries(d.stockByLocation).filter(([loc,q]) => Number(q) > 0).map(([loc,q]) => `${loc}: ${Number(q).toLocaleString("vi-VN")} ${d.unit || "cái"}`).join("; ") || d.location || "-" : d.location || "-"}</b></td>
        <td><b>${d.trackingMode === "quantity" ? Number(d.quantity || 0).toLocaleString("vi-VN") : "1"} ${d.unit || "cái"}</b></td>
        <td>
          <span class="badge ${
            d.status === 'Trong kho' ? 'badge-primary' : 
            (d.status === 'Đang sử dụng' ? 'badge-secondary' : 'badge-danger')
          }">${d.status || "Trong kho"}</span>
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

function handleDeviceCategoryChange() {
  const codeEl = document.getElementById("devCode");
  if (codeEl && (!codeEl.value.trim() || codeEl.dataset.manual !== "true")) suggestDeviceCode(false);
  const cat = String(document.getElementById("devCategory")?.value || "").toLowerCase();
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
  populateSelects();
  showModalById("movementModal");

  if (deviceCode) {
    const clean = String(deviceCode).trim().toLowerCase();
    const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === clean);
    if (dev) {
      setElementValueSafe("movDeviceCode", dev.code, true);
      setElementValueSafe("movFromLocation", dev.location || STATE.locations[0] || "", true);
      setElementValueSafe("movToLocation", dev.location || STATE.locations[0] || "", true);
    }
  }

  handleSelectDeviceForMovement();
}

function handleSelectDeviceForMovement() {
  const code = document.getElementById("movDeviceCode")?.value;
  const dev = STATE.devices.find(d => String(d.code).toLowerCase() === String(code).toLowerCase());
  const from = document.getElementById("movFromLocation");
  if (from && dev?.trackingMode === "quantity" && dev.stockByLocation) {
    const locs = Object.entries(dev.stockByLocation).filter(([loc,q]) => Number(q) > 0).map(([loc]) => loc);
    from.innerHTML = (locs.length ? locs : STATE.locations).map(l => `<option value="${l}">${l}</option>`).join("");
  } else if (from) {
    from.innerHTML = STATE.locations.map(l => `<option value="${l}">${l}</option>`).join("");
  }
  if (dev) {
    const preferred = dev.trackingMode === "quantity" && dev.stockByLocation
      ? (Object.entries(dev.stockByLocation).find(([loc, q]) => Number(q) > 0)?.[0] || dev.location)
      : dev.location;
    setElementValueSafe("movFromLocation", preferred || STATE.locations[0] || "", true);
  }
  handleMovementTypeChange();
}

function handleMovementTypeChange() {
  const typeEl = document.getElementById("movType");
  if (!typeEl) return;
  const type = typeEl.value;
  const devCode = document.getElementById("movDeviceCode")?.value;
  const dev = STATE.devices.find(d => String(d.code).toLowerCase() === String(devCode).toLowerCase());
  const noteInput = document.getElementById("movNote");
  const fromSelect = document.getElementById("movFromLocation");
  const qtyWrap = document.getElementById("movQuantityWrap");
  const qtyInput = document.getElementById("movQuantity");
  const qtyHelp = document.getElementById("movAvailableQty");
  if (dev?.trackingMode === "quantity") {
    const map = dev.stockByLocation || { [dev.location || "Kho kỹ thuật"]: Number(dev.quantity || 0) };
    const source = fromSelect?.value || dev.location;
    const available = Number(map[source] || 0);
    if (qtyWrap) qtyWrap.style.display = "block";
    if (qtyInput) { qtyInput.max = String(available); if (!qtyInput.value || Number(qtyInput.value) > available) qtyInput.value = available; }
    if (qtyHelp) qtyHelp.textContent = `Tồn tại vị trí này: ${available.toLocaleString("vi-VN")} ${dev.unit || "cái"}`;
  } else {
    if (qtyWrap) qtyWrap.style.display = "none";
    if (qtyInput) qtyInput.value = "1";
    if (qtyHelp) qtyHelp.textContent = "";
  }

  if (type === "Báo hỏng / Đi bảo hành") {
    const loc = STATE.locations.find(l => l.includes("Kho")) || STATE.locations[0] || "Kho kỹ thuật";
    setElementValueSafe("movToLocation", loc, true);
    if (noteInput) noteInput.placeholder = "VD: Cháy nguồn, hỏng quạt...";
  } else if (type === "Đã sửa xong / Nhập lại kho") {
    const loc = STATE.locations.find(l => l.includes("dự phòng") || l.includes("Kho")) || STATE.locations[0] || "Kho dự phòng";
    setElementValueSafe("movToLocation", loc, true);
    if (noteInput) noteInput.placeholder = "VD: Đã thay linh kiện, hoạt động tốt";
  } else if (type === "Báo thanh lý") {
    const loc = STATE.locations.find(l => l.includes("thanh lý")) || STATE.locations[0] || "Kho thanh lý";
    setElementValueSafe("movToLocation", loc, true);
    if (noteInput) noteInput.placeholder = "VD: Hỏng bo mạch chính không thể sửa...";
  } else {
    if (dev?.location) setElementValueSafe("movToLocation", dev.location, true);
    if (noteInput) noteInput.placeholder = "Ghi chú thêm...";
  }
}

async function handleSaveMovement(e) {
  e.preventDefault();
  const deviceCode = document.getElementById("movDeviceCode")?.value;
  const type = document.getElementById("movType")?.value;
  const toLocation = document.getElementById("movToLocation")?.value;
  const fromLocation = document.getElementById("movFromLocation")?.value;
  const quantity = Number(document.getElementById("movQuantity")?.value || 1);
  const note = (document.getElementById("movNote")?.value || "").trim();
  const dev = STATE.devices.find(d => d.code === deviceCode);
  if (dev?.trackingMode === "quantity" && (!Number.isFinite(quantity) || quantity <= 0)) return alert("Vui lòng nhập số lượng lớn hơn 0.");

  let newStatus = "Đang sử dụng";
  if (type === "Báo hỏng / Đi bảo hành") newStatus = "Hỏng / Bảo hành";
  else if (type === "Đã sửa xong / Nhập lại kho") newStatus = "Trong kho";
  else if (type === "Báo thanh lý") newStatus = "Thanh lý";

  await callMutate("movement.create", {
    deviceCode,
    type,
    fromLocation: fromLocation || (dev ? dev.location : ""),
    toLocation,
    status: newStatus,
    quantity,
    note
  });

  closeModal("movementModal");
  loadState();
}

function renderMovements() {
  const tbody = document.getElementById("movementTableBody");
  if (!tbody) return;
  tbody.innerHTML = STATE.movements.map(m => `
    <tr>
      <td>${m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "-"}</td>
      <td><b>${m.deviceCode}</b></td>
      <td><span class="badge ${m.type.includes('hỏng') || m.type.includes('thanh lý') ? 'badge-danger' : 'badge-secondary'}">${m.type}</span>${Number(m.quantity) > 0 ? `<small style="display:block;">SL: ${Number(m.quantity).toLocaleString("vi-VN")} ${m.unit || "cái"}</small>` : ""}</td>
      <td>${m.fromLocation || "-"}</td>
      <td><b>${m.toLocation || "-"}</b></td>
      <td><small>${m.note || "-"}</small></td>
      <td>${m.createdBy || "-"}</td>
    </tr>
  `).join("");
}

// ----------------------------------------------------
// VỊ TRÍ & KHO (LOCATIONS)
// ----------------------------------------------------
function renderLocations() {
  const tbody = document.getElementById("locationTableBody");
  if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";

  tbody.innerHTML = STATE.locations.map((loc, idx) => {
    const count = STATE.devices.filter(d => String(d.location).trim().toLowerCase() === String(loc).trim().toLowerCase()).reduce((sum, d) => sum + (Number(d.quantity) || 1), 0);
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${loc}</b></td>
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <button type="button" data-act="rename-loc" data-val="${loc}" style="cursor:pointer; margin-right:5px;">Đổi tên</button>
            <button type="button" data-act="del-loc" data-val="${loc}" style="color:red; cursor:pointer;">Xóa</button>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");
}

async function openAddLocationModal() {
  const name = prompt("Nhập tên Vị trí / Kho mới:");
  if (!name || !name.trim()) return;
  await callMutate("location.add", { name: name.trim() });
  await loadState();
}

async function renameLocation(oldName) {
  const newName = prompt(`Đổi tên vị trí/kho "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  await callMutate("location.update", { oldName, newName: newName.trim() });
  await loadState();
}

async function deleteLocation(name) {
  if (!confirm(`Bạn có chắc muốn xóa vị trí "${name}"?`)) return;
  await callMutate("location.delete", { name });
  await loadState();
}

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
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
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
  await callMutate("category.add", { name: name.trim() });
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
  const catOptions = STATE.categories.map(c => `<option value="${c}">${c}</option>`).join("");
  const devCat = document.getElementById("devCategory");
  if (devCat && devCat.tagName === "SELECT") devCat.innerHTML = catOptions;

  const filterCat = document.getElementById("filterCategory");
  if (filterCat && filterCat.tagName === "SELECT") filterCat.innerHTML = `<option value="">-- Tất cả danh mục --</option>` + catOptions;

  const locOptions = STATE.locations.map(l => `<option value="${l}">${l}</option>`).join("");
  const devLoc = document.getElementById("devLocation");
  if (devLoc && devLoc.tagName === "SELECT") devLoc.innerHTML = locOptions;

  const movLoc = document.getElementById("movToLocation");
  if (movLoc && movLoc.tagName === "SELECT") movLoc.innerHTML = locOptions;
  const movFromLoc = document.getElementById("movFromLocation");
  if (movFromLoc && movFromLoc.tagName === "SELECT") movFromLoc.innerHTML = locOptions;

  const bulkLoc = document.getElementById("bulkToLocation");
  if (bulkLoc && bulkLoc.tagName === "SELECT") bulkLoc.innerHTML = locOptions;

  const filterLoc = document.getElementById("filterLocation");
  if (filterLoc && filterLoc.tagName === "SELECT") filterLoc.innerHTML = `<option value="">-- Tất cả vị trí & kho --</option>` + locOptions;

  const movDev = document.getElementById("movDeviceCode");
  if (movDev && movDev.tagName === "SELECT") {
    movDev.innerHTML = STATE.devices.map(d => `<option value="${d.code}">${d.code} - ${d.name || d.code} (${d.location || 'Chưa gán'})</option>`).join("");
  }
}

// ĐIỀU CHUYỂN HÀNG LOẠT
function openBulkMovementModal() {
  showModalById("bulkMovementModal");
  const desc = document.getElementById("bulkModalDesc");
  if (desc) desc.innerText = `Đang thao tác cho ${selectedCodes.size} thiết bị đã chọn`;
}

function handleBulkTypeChange() {
  const type = document.getElementById("bulkType")?.value;
  if (type === "Báo hỏng / Đi bảo hành") {
    const defaultDamaged = STATE.locations.find(l => l.includes("Kho")) || STATE.locations[0] || "Kho kỹ thuật";
    setElementValueSafe("bulkToLocation", defaultDamaged, true);
  }
}

async function handleSaveBulkMovement(e) {
  e.preventDefault();
  const type = document.getElementById("bulkType")?.value;
  const toLocation = document.getElementById("bulkToLocation")?.value;
  const note = (document.getElementById("bulkNote")?.value || "").trim();

  let status = "Đang sử dụng";
  if (type === "Báo hỏng / Đi bảo hành") status = "Hỏng / Bảo hành";
  else if (type === "Đã sửa xong / Nhập lại kho") status = "Trong kho";
  else if (type === "Báo thanh lý") status = "Thanh lý";

  await callMutate("movement.bulk_create", {
    codes: Array.from(selectedCodes),
    type,
    toLocation,
    status,
    note
  });

  closeModal("bulkMovementModal");
  clearSelected();
  loadState();
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
  const headers = ["Thời gian", "Mã thiết bị", "Loại giao dịch", "Từ vị trí", "Đến vị trí", "Lý do/Ghi chú", "Người thực hiện"];
  const rows = [headers];
  STATE.movements.forEach(m => {
    rows.push([m.createdAt || "", m.deviceCode, m.type, m.fromLocation || "", m.toLocation || "", m.note || "", m.createdBy || ""]);
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
