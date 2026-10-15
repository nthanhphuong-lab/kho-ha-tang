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

// Bật Modal chắc chắn hiển thị
function showModalById(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("active");
  m.style.setProperty("display", "flex", "important");
}

// Đóng Modal
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("active");
  m.style.setProperty("display", "none", "important");
}

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("kho_token");
  const cachedUser = localStorage.getItem("kho_user");

  // GẮN SỰ KIỆN CLICK TRỰC TIẾP LÊN BẢNG THIẾT BỊ
  const devTbody = document.getElementById("deviceTableBody");
  if (devTbody) {
    devTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const act = btn.getAttribute("data-act");
      const code = btn.getAttribute("data-val") || "";

      if (act === "edit-dev") {
        openDeviceModal(code);
      } else if (act === "quick-mov") {
        openMovementModal(code);
      } else if (act === "del-dev") {
        deleteDeviceByCode(code);
      }
    });

    devTbody.addEventListener("change", (e) => {
      const chk = e.target.closest("input.dev-check");
      if (chk) {
        toggleSelectDevice(chk.value, chk.checked);
      }
    });
  }

  // GẮN SỰ KIỆN CLICK TRỰC TIẾP LÊN BẢNG VỊ TRÍ
  const locTbody = document.getElementById("locationTableBody");
  if (locTbody) {
    locTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const act = btn.getAttribute("data-act");
      const val = btn.getAttribute("data-val") || "";

      if (act === "rename-loc") {
        renameLocation(val);
      } else if (act === "del-loc") {
        deleteLocation(val);
      }
    });
  }

  // GẮN SỰ KIỆN CLICK TRỰC TIẾP LÊN BẢNG DANH MỤC
  const catTbody = document.getElementById("categoryTableBody");
  if (catTbody) {
    catTbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const act = btn.getAttribute("data-act");
      const val = btn.getAttribute("data-val") || "";

      if (act === "rename-cat") {
        renameCategory(val);
      } else if (act === "del-cat") {
        deleteCategory(val);
      }
    });
  }

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
    devices: "Danh sách thiết bị",
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
  if (total) total.innerText = STATE.devices.length;
  const inStock = document.getElementById("statInStock");
  if (inStock) inStock.innerText = STATE.devices.filter(d => d.status === "Trong kho").length;
  const inUse = document.getElementById("statInUse");
  if (inUse) inUse.innerText = STATE.devices.filter(d => d.status === "Đang sử dụng").length;
  const faulty = document.getElementById("statFaulty");
  if (faulty) faulty.innerText = STATE.devices.filter(d => 
    (d.status || "").includes("Hỏng") || (d.status || "").includes("Thanh lý")
  ).length;
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
          <td style="width: 36px;">
            <input type="checkbox" class="dev-check" value="${d.code}" ${isChecked ? 'checked' : ''}>
          </td>` : `<td></td>`}
        <td><b>${d.code}</b></td>
        <td>
          <div><b>${d.name || d.code}</b></div>
          ${d.notes ? `<small class="muted" style="display:block; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${d.notes}</small>` : ''}
        </td>
        <td>${d.model || "-"}</td>
        <td><code>${d.serial || "-"}</code></td>
        <td>${d.category || ""}</td>
        <td><b>${d.location || "-"}</b></td>
        <td>
          <span class="badge ${
            d.status === 'Trong kho' ? 'badge-primary' : 
            (d.status === 'Đang sử dụng' ? 'badge-secondary' : 'badge-danger')
          }">${d.status || "Trong kho"}</span>
        </td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <div class="action-btn-group">
              <button type="button" class="primary btn-action-sm" data-act="quick-mov" data-val="\${d.code}" title="Điều chuyển hoặc báo sự cố">Chuyển</button>
              <button type="button" class="secondary btn-action-sm" data-act="edit-dev" data-val="\${d.code}" title="Chỉnh sửa thông tin thiết bị">Sửa</button>
              <button type="button" class="secondary btn-action-sm" data-act="del-dev" data-val="\${d.code}" style="color:red;" title="Xóa thiết bị">Xóa</button>
            </div>
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
    bar.classList.add("active");
  } else {
    bar.classList.add("hidden");
    bar.classList.remove("active");
  }
}

// ----------------------------------------------------
// THAO TÁC THIẾT BỊ
// ----------------------------------------------------
function openDeviceModal(deviceCode = null) {
  populateSelects();
  showModalById("deviceModal");

  const titleEl = document.getElementById("deviceModalTitle");
  const codeEl = document.getElementById("devCode");

  if (deviceCode) {
    const clean = String(deviceCode).trim().toLowerCase();
    const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === clean);
    if (dev) {
      if (titleEl) titleEl.innerText = "Chỉnh sửa hồ sơ thiết bị";
      if (codeEl) {
        codeEl.value = dev.code || "";
        codeEl.readOnly = true;
      }
      setElementValueSafe("devName", dev.name || "");
      setElementValueSafe("devModel", dev.model || "");
      setElementValueSafe("devSerial", dev.serial || "");
      setElementValueSafe("devCategory", dev.category || "", true);
      setElementValueSafe("devLocation", dev.location || "", true);
      setElementValueSafe("devStatus", dev.status || "Trong kho", true);
      setElementValueSafe("devNotes", dev.notes || "");
      return;
    }
  }

  // Chế độ Thêm mới
  if (titleEl) titleEl.innerText = "Thêm thiết bị mới";
  if (codeEl) {
    codeEl.value = "";
    codeEl.readOnly = false;
  }
  setElementValueSafe("devName", "");
  setElementValueSafe("devModel", "");
  setElementValueSafe("devSerial", "");
  setElementValueSafe("devCategory", STATE.categories[0] || "", true);
  setElementValueSafe("devLocation", STATE.locations[0] || "", true);
  setElementValueSafe("devStatus", "Trong kho", true);
  setElementValueSafe("devNotes", "");
}

async function deleteDeviceByCode(code) {
  if (!confirm(`Bạn có chắc chắn muốn xóa thiết bị [${code}]?`)) return;
  try {
    await callMutate("device.delete", { code });
    await loadState();
  } catch (err) {
    console.error(err);
  }
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
  const notes = (document.getElementById("devNotes")?.value || "").trim();
  const isEdit = document.getElementById("devCode")?.readOnly;

  const action = isEdit ? "device.update" : "device.add";
  try {
    await callMutate(action, { code, name, model, serial, category, location, status, notes });
    closeModal("deviceModal");
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

// ----------------------------------------------------
// ĐIỀU CHUYỂN / BÁO SỰ CỐ
// ----------------------------------------------------
function openMovementModal(deviceCode = null) {
  populateSelects();
  showModalById("movementModal");

  const clean = String(deviceCode || "").trim().toLowerCase();
  const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === clean);

  const devSelect = document.getElementById("movDeviceCode");
  if (dev && devSelect) {
    devSelect.value = dev.code;
    setElementValueSafe("movToLocation", dev.location || "", true);
  }

  handleMovementTypeChange();
}

function handleSelectDeviceForMovement() {
  const devCode = document.getElementById("movDeviceCode")?.value;
  const dev = STATE.devices.find(d => String(d.code).toLowerCase() === String(devCode).toLowerCase());
  if (dev && dev.location) {
    setElementValueSafe("movToLocation", dev.location, true);
  }
}

function handleMovementTypeChange() {
  const typeEl = document.getElementById("movType");
  if (!typeEl) return;
  const type = typeEl.value;
  const devCode = document.getElementById("movDeviceCode")?.value;
  const dev = STATE.devices.find(d => String(d.code).toLowerCase() === String(devCode).toLowerCase());
  const noteInput = document.getElementById("movNote");

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
    if (noteInput) noteInput.placeholder = "Ghi chú điều chuyển...";
  }
}

async function handleSaveMovement(e) {
  e.preventDefault();
  const deviceCode = document.getElementById("movDeviceCode")?.value;
  const type = document.getElementById("movType")?.value;
  const toLocation = document.getElementById("movToLocation")?.value;
  const note = (document.getElementById("movNote")?.value || "").trim();
  const dev = STATE.devices.find(d => d.code === deviceCode);

  let newStatus = dev ? (dev.status || "Đang sử dụng") : "Đang sử dụng";
  if (type === "Báo hỏng / Đi bảo hành") newStatus = "Hỏng / Bảo hành";
  else if (type === "Đã sửa xong / Nhập lại kho") newStatus = "Trong kho";
  else if (type === "Báo thanh lý") newStatus = "Thanh lý";
  else if (type === "Xuất kho") newStatus = "Đang sử dụng";

  try {
    await callMutate("movement.create", {
      deviceCode,
      type,
      fromLocation: dev ? dev.location : "",
      toLocation,
      status: newStatus,
      note
    });
    closeModal("movementModal");
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

function renderMovements() {
  const tbody = document.getElementById("movementTableBody");
  if (!tbody) return;
  tbody.innerHTML = STATE.movements.map(m => `
    <tr>
      <td>${m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "-"}</td>
      <td><b>${m.deviceCode}</b></td>
      <td><span class="badge ${m.type.includes('hỏng') || m.type.includes('thanh lý') ? 'badge-danger' : 'badge-secondary'}">${m.type}</span></td>
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
    const count = STATE.devices.filter(d => String(d.location).trim().toLowerCase() === String(loc).trim().toLowerCase()).length;
    return `
      <tr>
        <td style="width: 60px;">${idx + 1}</td>
        <td><b>${loc}</b></td>
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <div class="action-btn-group">
              <button type="button" class="secondary btn-action-sm" data-act="rename-loc" data-val="\${loc}">Đổi tên</button>
              <button type="button" class="secondary btn-action-sm" data-act="del-loc" data-val="\${loc}" style="color:red;">Xóa</button>
            </div>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");
}

async function openAddLocationModal() {
  const name = prompt("Nhập tên Vị trí / Kho mới:");
  if (!name || !name.trim()) return;
  try {
    await callMutate("location.add", { name: name.trim() });
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

async function renameLocation(oldName) {
  const newName = prompt(`Đổi tên vị trí/kho "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  try {
    await callMutate("location.update", { oldName: oldName.trim(), newName: newName.trim() });
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

async function deleteLocation(name) {
  if (!confirm(`Bạn có chắc muốn xóa vị trí "${name}"?`)) return;
  try {
    await callMutate("location.delete", { name: name.trim() });
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

// ----------------------------------------------------
// DANH MỤC (CATEGORIES)
// ----------------------------------------------------
function renderCategories() {
  const tbody = document.getElementById("categoryTableBody");
  if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";

  tbody.innerHTML = STATE.categories.map((cat, idx) => {
    const count = STATE.devices.filter(d => String(d.category).trim().toLowerCase() === String(cat).trim().toLowerCase()).length;
    return `
      <tr>
        <td style="width: 60px;">${idx + 1}</td>
        <td><b>${cat}</b></td>
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <div class="action-btn-group">
              <button type="button" class="secondary btn-action-sm" data-act="rename-cat" data-val="\${cat}">Đổi tên</button>
              <button type="button" class="secondary btn-action-sm" data-act="del-cat" data-val="\${cat}" style="color:red;">Xóa</button>
            </div>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");
}

async function openAddCategoryModal() {
  const name = prompt("Nhập tên danh mục mới:");
  if (!name || !name.trim()) return;
  try {
    await callMutate("category.add", { name: name.trim() });
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

async function renameCategory(oldName) {
  const newName = prompt(`Đổi tên danh mục "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  try {
    await callMutate("category.update", { oldName: oldName.trim(), newName: newName.trim() });
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

async function deleteCategory(name) {
  if (!confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) return;
  try {
    await callMutate("category.delete", { name: name.trim() });
    await loadState();
  } catch (err) {
    console.error(err);
  }
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

  try {
    await callMutate("movement.bulk_create", {
      codes: Array.from(selectedCodes),
      type,
      toLocation,
      status,
      note
    });
    closeModal("bulkMovementModal");
    clearSelected();
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

async function bulkDeleteDevices() {
  if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedCodes.size} thiết bị đã chọn?`)) return;
  try {
    await callMutate("device.delete", { codes: Array.from(selectedCodes) });
    clearSelected();
    await loadState();
  } catch (err) {
    console.error(err);
  }
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
        notes: cols[7] || ""
      });
    }
  }

  if (items.length === 0) return alert("Không tìm thấy dữ liệu hợp lệ trong file");

  if (!confirm(`Đã tìm thấy ${items.length} thiết bị từ file. Bắt đầu nạp vào hệ thống?`)) return;

  const statusEl = document.getElementById("syncStatus");
  if (statusEl) statusEl.innerText = "Đang nạp dữ liệu...";
  try {
    await callMutate("device.bulk_add", { items });
    alert(`Đã nạp thành công thiết bị vào hệ thống!`);
    await loadState();
  } catch (err) {
    console.error(err);
  }
}

function downloadSampleCSV() {
  const sample = "\uFEFFMã thiết bị,Tên thiết bị,Model/Hãng,Serial/MAC,Danh mục,Vị trí,Tình trạng,Ghi chú\nSW-TEST-01,Switch 24p Cisco,WS-C2960,FOC111222,Switch mạng,Kho kỹ thuật - Tầng 1,Trong kho,Nhập đợt 1\nAP-TEST-02,Access Point Ruijie,RG-AP720-L,RUIJIE8889,Access Point Wi-Fi,Tòa nhà B - Phòng Lab 1,Đang sử dụng,Lắp trần";
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
      handleScannedResult(decodedText.trim());
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
    rows.push([d.code, d.name, d.model || "", d.serial || "", d.category, d.location || "", d.status, d.notes || ""]);
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
            <button type="button" onclick="deleteUser('\${u.username}')" style="color:red; cursor:pointer;">Xóa</button>
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
