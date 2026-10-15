let STATE = {
  devices: [],
  movements: [],
  categories: [],
  locations: [],
  currentUser: null
};

let selectedCodes = new Set();
let html5QrCode = null;

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
    document.getElementById("login").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }
});

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const target = document.getElementById(viewId);
  if (target) target.classList.remove("hidden");

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
  document.getElementById("pageTitle").innerText = titles[viewId] || "Kho";

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
  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("currentUserName").innerText = STATE.currentUser.displayName || STATE.currentUser.username;
  document.getElementById("userRoleBadge").innerText = STATE.currentUser.role === "admin" ? "Quản trị viên" : "Người xem (Viewer)";

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
  document.getElementById("syncStatus").innerText = "Đang tải...";

  try {
    const res = await fetch(`${API_BASE_URL}/api/state`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) return handleLogout();
    const data = await res.json();

    STATE.devices = data.devices || [];
    STATE.movements = data.movements || [];
    STATE.categories = data.categories || [];
    STATE.locations = data.locations || [];

    renderDashboard();
    populateSelects();
    renderDevices();
    renderMovements();
    renderCategories();
    renderLocations();

    document.getElementById("syncStatus").innerText = "Đã đồng bộ";
  } catch (err) {
    document.getElementById("syncStatus").innerText = "Lỗi kết nối";
  }
}

function renderDashboard() {
  document.getElementById("statTotalDevices").innerText = STATE.devices.length;
  document.getElementById("statInStock").innerText = STATE.devices.filter(d => d.status === "Trong kho").length;
  document.getElementById("statInUse").innerText = STATE.devices.filter(d => d.status === "Đang sử dụng").length;
  document.getElementById("statFaulty").innerText = STATE.devices.filter(d => 
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
  if (document.getElementById("deviceSearch")) document.getElementById("deviceSearch").value = "";
  if (document.getElementById("filterCategory")) document.getElementById("filterCategory").value = "";
  if (document.getElementById("filterLocation")) document.getElementById("filterLocation").value = "";
  renderDevices();
}

function renderDevices() {
  const filtered = getFilteredDevices();
  const tbody = document.getElementById("deviceTableBody");
  const countEl = document.getElementById("filterResultCount");
  const isAdmin = STATE.currentUser?.role === "admin";

  if (countEl) countEl.innerText = `Đang hiển thị ${filtered.length} / ${STATE.devices.length} thiết bị`;

  tbody.innerHTML = filtered.map(d => {
    const isChecked = selectedCodes.has(d.code);
    const safeCode = encodeURIComponent(d.code);
    return `
      <tr>
        ${isAdmin ? `
          <td>
            <input type="checkbox" class="dev-check" value="\${d.code}" ${isChecked ? 'checked' : ''} onchange="toggleSelectDevice('${d.code}', this.checked)">
          </td>` : `<td></td>`}
        <td><b>${d.code}</b></td>
        <td>
          <div><b>${d.name}</b></div>
          ${d.notes ? `<small class="muted" style="display:block; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${d.notes}</small>` : ''}
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
          <td style="text-align:right; white-space:nowrap;">
            <button onclick="quickAction(decodeURIComponent('\${safeCode}'))" style="background:#2563eb; color:#fff; cursor:pointer; margin-right:4px;">Chuyển/Báo hỏng</button>
            <button onclick="editDevice(decodeURIComponent('\${safeCode}'))" style="cursor:pointer; margin-right:4px;">Sửa</button>
            <button onclick="deleteDevice(decodeURIComponent('\${safeCode}'))" style="color:red; cursor:pointer;">Xóa</button>
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
    countEl.innerText = selectedCodes.size;
    bar.classList.remove("hidden");
  } else {
    bar.classList.add("hidden");
  }
}

// ----------------------------------------------------
// THIẾT BỊ (SỬA LỖI KHÔNG NẠP ĐƯỢC FORM SỬA THIẾT BỊ)
// ----------------------------------------------------
function openDeviceModal(code = null) {
  populateSelects(); // Đảm bảo danh mục và vị trí đã được nạp vào option
  document.getElementById("deviceModal").classList.remove("hidden");

  if (code) {
    // So sánh chuẩn hóa không phân biệt hoa thường và khoảng trắng
    const cleanCode = String(code).trim().toLowerCase();
    const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === cleanCode);

    if (dev) {
      document.getElementById("deviceModalTitle").innerText = "Chỉnh sửa hồ sơ thiết bị";
      document.getElementById("devCode").value = dev.code || "";
      document.getElementById("devCode").readOnly = true;
      document.getElementById("devName").value = dev.name || "";
      document.getElementById("devModel").value = dev.model || "";
      document.getElementById("devSerial").value = dev.serial || "";
      document.getElementById("devCategory").value = dev.category || STATE.categories[0] || "";
      document.getElementById("devLocation").value = dev.location || STATE.locations[0] || "";
      document.getElementById("devStatus").value = dev.status || "Trong kho";
      document.getElementById("devNotes").value = dev.notes || "";
      return;
    }
  }

  // Chế độ thêm mới nếu không truyền code
  document.getElementById("deviceModalTitle").innerText = "Thêm thiết bị mới";
  document.getElementById("devCode").value = "";
  document.getElementById("devCode").readOnly = false;
  document.getElementById("devName").value = "";
  document.getElementById("devModel").value = "";
  document.getElementById("devSerial").value = "";
  document.getElementById("devCategory").value = STATE.categories[0] || "";
  document.getElementById("devLocation").value = STATE.locations[0] || "";
  document.getElementById("devStatus").value = "Trong kho";
  document.getElementById("devNotes").value = "";
}

function editDevice(code) {
  openDeviceModal(code);
}

async function handleSaveDevice(e) {
  e.preventDefault();
  const code = document.getElementById("devCode").value.trim();
  const name = document.getElementById("devName").value.trim();
  const model = document.getElementById("devModel").value.trim();
  const serial = document.getElementById("devSerial").value.trim();
  const category = document.getElementById("devCategory").value;
  const location = document.getElementById("devLocation").value;
  const status = document.getElementById("devStatus").value;
  const notes = document.getElementById("devNotes").value.trim();
  const isEdit = document.getElementById("devCode").readOnly;

  const action = isEdit ? "device.update" : "device.add";
  await callMutate(action, { code, name, model, serial, category, location, status, notes });
  closeModal("deviceModal");
  loadState();
}

async function deleteDevice(code) {
  if (!confirm(`Bạn có chắc chắn muốn xóa thiết bị [${code}]?`)) return;
  await callMutate("device.delete", { code });
  loadState();
}

// ----------------------------------------------------
// THAO TÁC ĐIỀU CHUYỂN / BÁO SỰ CỐ
// ----------------------------------------------------
function openMovementModal(preSelectCode = null) {
  populateSelects();
  document.getElementById("movementModal").classList.remove("hidden");

  if (preSelectCode) {
    const cleanCode = String(preSelectCode).trim().toLowerCase();
    const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === cleanCode);
    if (dev) {
      document.getElementById("movDeviceCode").value = dev.code;
    }
  }

  handleMovementTypeChange();
}

function quickAction(code) {
  openMovementModal(code);
}

function handleSelectDeviceForMovement() {
  handleMovementTypeChange();
}

function handleMovementTypeChange() {
  const type = document.getElementById("movType").value;
  const devCode = document.getElementById("movDeviceCode").value;
  const cleanCode = String(devCode).trim().toLowerCase();
  const dev = STATE.devices.find(d => String(d.code).trim().toLowerCase() === cleanCode);
  const toLocSelect = document.getElementById("movToLocation");
  const noteInput = document.getElementById("movNote");

  if (type === "Báo hỏng / Đi bảo hành") {
    const loc = STATE.locations.find(l => l.includes("Kho")) || STATE.locations[0];
    if (loc) toLocSelect.value = loc;
    noteInput.placeholder = "VD: Cháy nguồn, hỏng quạt...";
  } else if (type === "Đã sửa xong / Nhập lại kho") {
    const loc = STATE.locations.find(l => l.includes("dự phòng") || l.includes("Kho")) || STATE.locations[0];
    if (loc) toLocSelect.value = loc;
    noteInput.placeholder = "VD: Đã thay linh kiện, hoạt động tốt";
  } else if (type === "Báo thanh lý") {
    const loc = STATE.locations.find(l => l.includes("thanh lý")) || STATE.locations[0];
    if (loc) toLocSelect.value = loc;
    noteInput.placeholder = "VD: Hỏng bo mạch chính không thể sửa...";
  } else {
    if (dev?.location) toLocSelect.value = dev.location;
    noteInput.placeholder = "Ghi chú thêm...";
  }
}

async function handleSaveMovement(e) {
  e.preventDefault();
  const deviceCode = document.getElementById("movDeviceCode").value;
  const type = document.getElementById("movType").value;
  const toLocation = document.getElementById("movToLocation").value;
  const note = document.getElementById("movNote").value.trim();
  const dev = STATE.devices.find(d => d.code === deviceCode);

  let newStatus = "Đang sử dụng";
  if (type === "Báo hỏng / Đi bảo hành") newStatus = "Hỏng / Bảo hành";
  else if (type === "Đã sửa xong / Nhập lại kho") newStatus = "Trong kho";
  else if (type === "Báo thanh lý") newStatus = "Thanh lý";

  await callMutate("movement.create", {
    deviceCode,
    type,
    fromLocation: dev ? dev.location : "",
    toLocation,
    status: newStatus,
    note
  });

  closeModal("movementModal");
  loadState();
}

function renderMovements() {
  const tbody = document.getElementById("movementTableBody");
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
    const count = STATE.devices.filter(d => d.location === loc).length;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${loc}</b></td>
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <button onclick="renameLocation('\${loc}')" style="cursor:pointer; margin-right:5px;">Đổi tên</button>
            <button onclick="deleteLocation('\${loc}')" style="color:red; cursor:pointer;">Xóa</button>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");
}

async function openAddLocationModal() {
  const name = prompt("Nhập tên Vị trí / Kho mới:");
  if (!name || !name.trim()) return;
  await callMutate("location.add", { name: name.trim() });
  loadState();
}

async function renameLocation(oldName) {
  const newName = prompt(`Đổi tên vị trí/kho "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  await callMutate("location.update", { oldName, newName: newName.trim() });
  loadState();
}

async function deleteLocation(name) {
  if (!confirm(`Bạn có chắc muốn xóa vị trí "${name}"?`)) return;
  await callMutate("location.delete", { name });
  loadState();
}

// NẠP DỮ LIỆU SELECT DROPDOWN
function populateSelects() {
  const catOptions = STATE.categories.map(c => `<option value="${c}">${c}</option>`).join("");
  const devCat = document.getElementById("devCategory");
  if (devCat) devCat.innerHTML = catOptions;

  const filterCat = document.getElementById("filterCategory");
  if (filterCat) filterCat.innerHTML = `<option value="">-- Tất cả danh mục --</option>` + catOptions;

  const locOptions = STATE.locations.map(l => `<option value="${l}">${l}</option>`).join("");
  const devLoc = document.getElementById("devLocation");
  if (devLoc) devLoc.innerHTML = locOptions;

  const movLoc = document.getElementById("movToLocation");
  if (movLoc) movLoc.innerHTML = locOptions;

  const bulkLoc = document.getElementById("bulkToLocation");
  if (bulkLoc) bulkLoc.innerHTML = locOptions;

  const filterLoc = document.getElementById("filterLocation");
  if (filterLoc) filterLoc.innerHTML = `<option value="">-- Tất cả vị trí & kho --</option>` + locOptions;

  const movDev = document.getElementById("movDeviceCode");
  if (movDev) movDev.innerHTML = STATE.devices.map(d => `<option value="${d.code}">${d.code} - ${d.name} (${d.location || 'Chưa gán'})</option>`).join("");
}

// ĐIỀU CHUYỂN HÀNG LOẠT
function openBulkMovementModal() {
  document.getElementById("bulkMovementModal").classList.remove("hidden");
  document.getElementById("bulkModalDesc").innerText = `Đang thao tác cho ${selectedCodes.size} thiết bị đã chọn`;
}

function handleBulkTypeChange() {
  const type = document.getElementById("bulkType").value;
  const bulkLoc = document.getElementById("bulkToLocation");
  if (type === "Báo hỏng / Đi bảo hành") {
    const defaultDamaged = STATE.locations.find(l => l.includes("Kho")) || STATE.locations[0];
    if (defaultDamaged) bulkLoc.value = defaultDamaged;
  }
}

async function handleSaveBulkMovement(e) {
  e.preventDefault();
  const type = document.getElementById("bulkType").value;
  const toLocation = document.getElementById("bulkToLocation").value;
  const note = document.getElementById("bulkNote").value.trim();

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
  document.getElementById("csvFileInput").click();
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

  document.getElementById("syncStatus").innerText = "Đang nạp dữ liệu...";
  await callMutate("device.bulk_add", { items });
  alert(`Đã nạp thành công thiết bị vào hệ thống!`);
  loadState();
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
  document.getElementById("scannerModal").classList.remove("hidden");
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
      document.getElementById("scannerModal").classList.add("hidden");
    }).catch(() => {
      document.getElementById("scannerModal").classList.add("hidden");
    });
  } else {
    document.getElementById("scannerModal").classList.add("hidden");
  }
}

function handleScannedResult(code) {
  const cleanCode = String(code).trim().toLowerCase();
  const dev = STATE.devices.find(d => 
    String(d.code).trim().toLowerCase() === cleanCode || 
    (d.serial && String(d.serial).trim().toLowerCase() === cleanCode)
  );

  if (dev) {
    quickAction(dev.code);
  } else {
    if (confirm(`Mã [${code}] chưa có trong hệ thống. Bạn có muốn thêm mới thiết bị với mã này không?`)) {
      openDeviceModal();
      document.getElementById("devCode").value = code;
    }
  }
}

// DANH MỤC
function renderCategories() {
  const tbody = document.getElementById("categoryTableBody");
  if (!tbody) return;
  const isAdmin = STATE.currentUser?.role === "admin";

  tbody.innerHTML = STATE.categories.map((cat, idx) => {
    const count = STATE.devices.filter(d => d.category === cat).length;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${cat}</b></td>
        <td><span class="badge badge-secondary">${count} thiết bị</span></td>
        ${isAdmin ? `
          <td style="text-align:right;">
            <button onclick="renameCategory('\${cat}')" style="cursor:pointer; margin-right:5px;">Đổi tên</button>
            <button onclick="deleteCategory('\${cat}')" style="color:red; cursor:pointer;">Xóa</button>
          </td>` : `<td></td>`}
      </tr>
    `;
  }).join("");
}

async function openAddCategoryModal() {
  const name = prompt("Nhập tên danh mục mới:");
  if (!name || !name.trim()) return;
  await callMutate("category.add", { name: name.trim() });
  loadState();
}

async function renameCategory(oldName) {
  const newName = prompt(`Đổi tên danh mục "${oldName}" thành:`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  await callMutate("category.update", { oldName, newName: newName.trim() });
  loadState();
}

async function deleteCategory(name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${name}"?`)) return;
  await callMutate("category.delete", { name });
  loadState();
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
  if (!res.ok) alert(data.error || "Thao tác thất bại");
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

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><b>${u.username}</b></td>
        <td>${u.displayName || ""}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-secondary'}">${u.role === 'admin' ? 'Quản trị viên' : 'Chỉ xem (Viewer)'}</span></td>
        <td style="text-align:right;">
          ${u.username.toLowerCase() !== 'admin' ? `
            <button onclick="deleteUser('\${u.username}')" style="color:red; cursor:pointer;">Xóa</button>
          ` : '<small class="muted">Tài khoản chính</small>'}
        </td>
      </tr>
    `).join("");
  } catch (e) {
    console.error("Lỗi nạp users:", e);
  }
}

function openUserModal() {
  document.getElementById("userModal").classList.remove("hidden");
  document.getElementById("usrUsername").value = "";
  document.getElementById("usrUsername").readOnly = false;
  document.getElementById("usrPassword").value = "";
  document.getElementById("usrDisplayName").value = "";
  document.getElementById("usrRole").value = "viewer";
}

async function handleSaveUser(e) {
  e.preventDefault();
  const username = document.getElementById("usrUsername").value.trim();
  const password = document.getElementById("usrPassword").value;
  const displayName = document.getElementById("usrDisplayName").value.trim();
  const role = document.getElementById("usrRole").value;

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

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}
