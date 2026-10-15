// Quản lý trạng thái
let STATE = {
  devices: [],
  movements: [],
  categories: [],
  currentUser: null
};

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
    movements: "Lịch sử xuất / nhập",
    categories: "Danh mục thiết bị",
    reports: "Báo cáo dữ liệu",
    users: "Quản trị người dùng"
  };
  document.getElementById("pageTitle").innerText = titles[viewId] || "Kho";

  if (viewId === "users") loadUsers();
  if (viewId === "categories") renderCategories();
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

    renderDashboard();
    renderDevices();
    renderMovements();
    renderCategories();
    populateSelects();

    document.getElementById("syncStatus").innerText = "Đã đồng bộ";
  } catch (err) {
    document.getElementById("syncStatus").innerText = "Lỗi kết nối";
  }
}

function renderDashboard() {
  document.getElementById("statTotalDevices").innerText = STATE.devices.length;
  document.getElementById("statInStock").innerText = STATE.devices.filter(d => d.status === "Trong kho").length;
  document.getElementById("statInUse").innerText = STATE.devices.filter(d => d.status === "Đang sử dụng").length;
  document.getElementById("statFaulty").innerText = STATE.devices.filter(d => (d.status || "").includes("Hỏng")).length;
}

function renderDevices() {
  const q = (document.getElementById("deviceSearch")?.value || "").toLowerCase();
  const filtered = STATE.devices.filter(d =>
    (d.code || "").toLowerCase().includes(q) ||
    (d.name || "").toLowerCase().includes(q) ||
    (d.model || "").toLowerCase().includes(q) ||
    (d.serial || "").toLowerCase().includes(q) ||
    (d.location || "").toLowerCase().includes(q)
  );

  const tbody = document.getElementById("deviceTableBody");
  const isAdmin = STATE.currentUser?.role === "admin";

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td><b>${d.code}</b></td>
      <td>${d.name}</td>
      <td>${d.model || "-"}</td>
      <td><code>${d.serial || "-"}</code></td>
      <td>${d.category || ""}</td>
      <td>${d.location || "-"}</td>
      <td><span class="badge ${d.status === 'Trong kho' ? 'badge-primary' : 'badge-secondary'}">${d.status || "Trong kho"}</span></td>
      ${isAdmin ? `
        <td style="text-align:right;">
          <button onclick="editDevice('\${d.code}')" style="cursor:pointer; margin-right:5px;">Sửa</button>
          <button onclick="deleteDevice('\${d.code}')" style="color:red; cursor:pointer;">Xóa</button>
        </td>` : `<td></td>`}
    </tr>
  `).join("");
}

function renderMovements() {
  const tbody = document.getElementById("movementTableBody");
  tbody.innerHTML = STATE.movements.map(m => `
    <tr>
      <td>${m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "-"}</td>
      <td><b>${m.deviceCode}</b></td>
      <td>${m.type}</td>
      <td>${m.fromLocation || "-"}</td>
      <td>${m.toLocation || "-"}</td>
      <td>${m.createdBy || "-"}</td>
    </tr>
  `).join("");
}

// ----------------------------------------------------
// QUẢN LÝ DANH MỤC (CÓ THÊM, SỬA, XÓA)
// ----------------------------------------------------
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

function populateSelects() {
  const devCat = document.getElementById("devCategory");
  devCat.innerHTML = STATE.categories.map(c => `<option value="${c}">${c}</option>`).join("");

  const movDev = document.getElementById("movDeviceCode");
  movDev.innerHTML = STATE.devices.map(d => `<option value="${d.code}">${d.code} - ${d.name}</option>`).join("");
}

// MODAL & GHI DỮ LIỆU THIẾT BỊ
function openDeviceModal(code = null) {
  document.getElementById("deviceModal").classList.remove("hidden");
  if (code) {
    const dev = STATE.devices.find(d => d.code === code);
    document.getElementById("deviceModalTitle").innerText = "Chỉnh sửa thiết bị";
    document.getElementById("devCode").value = dev.code;
    document.getElementById("devCode").readOnly = true;
    document.getElementById("devName").value = dev.name;
    document.getElementById("devModel").value = dev.model || "";
    document.getElementById("devSerial").value = dev.serial || "";
    document.getElementById("devCategory").value = dev.category;
    document.getElementById("devLocation").value = dev.location || "";
    document.getElementById("devStatus").value = dev.status || "Trong kho";
    document.getElementById("devNotes").value = dev.notes || "";
  } else {
    document.getElementById("deviceModalTitle").innerText = "Thêm thiết bị mới";
    document.getElementById("devCode").value = "";
    document.getElementById("devCode").readOnly = false;
    document.getElementById("devName").value = "";
    document.getElementById("devModel").value = "";
    document.getElementById("devSerial").value = "";
    document.getElementById("devLocation").value = "";
    document.getElementById("devNotes").value = "";
  }
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
  const location = document.getElementById("devLocation").value.trim();
  const status = document.getElementById("devStatus").value;
  const notes = document.getElementById("devNotes").value.trim();
  const isEdit = document.getElementById("devCode").readOnly;

  const action = isEdit ? "device.update" : "device.add";
  await callMutate(action, { code, name, model, serial, category, location, status, notes });
  closeModal("deviceModal");
  loadState();
}

async function deleteDevice(code) {
  if (!confirm(`Bạn có chắc chắn muốn xóa thiết bị ${code}?`)) return;
  await callMutate("device.delete", { code });
  loadState();
}

// XUẤT NHẬP KHO
function openMovementModal() {
  document.getElementById("movementModal").classList.remove("hidden");
}

async function handleSaveMovement(e) {
  e.preventDefault();
  const deviceCode = document.getElementById("movDeviceCode").value;
  const type = document.getElementById("movType").value;
  const toLocation = document.getElementById("movToLocation").value.trim();
  const dev = STATE.devices.find(d => d.code === deviceCode);

  await callMutate("movement.create", {
    deviceCode,
    type,
    fromLocation: dev ? dev.location : "",
    toLocation,
    status: type === "Xuất kho" ? "Đang sử dụng" : (type === "Nhập kho" ? "Trong kho" : "Hỏng / Bảo hành")
  });
  closeModal("movementModal");
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
}

// ----------------------------------------------------
// BÁO CÁO (XUẤT FILE CSV EXCEL)
// ----------------------------------------------------
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

  let csvFile = '\uFEFF'; // UTF-8 BOM để Excel hiển thị đúng dấu tiếng Việt
  for (let i = 0; i < rows.length; i++) {
    csvFile += processRow(rows[i]);
  }

  const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportDevicesCSV() {
  const headers = ["Mã thiết bị", "Tên thiết bị", "Model/Hãng", "Serial/MAC", "Danh mục", "Vị trí", "Tình trạng", "Ghi chú"];
  const rows = [headers];
  STATE.devices.forEach(d => {
    rows.push([d.code, d.name, d.model || "", d.serial || "", d.category, d.location || "", d.status, d.notes || ""]);
  });
  downloadCSV(`danh_sach_thiet_bi_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportMovementsCSV() {
  const headers = ["Thời gian", "Mã thiết bị", "Loại giao dịch", "Từ vị trí", "Đến vị trí", "Người thực hiện"];
  const rows = [headers];
  STATE.movements.forEach(m => {
    rows.push([m.createdAt || "", m.deviceCode, m.type, m.fromLocation || "", m.toLocation || "", m.createdBy || ""]);
  });
  downloadCSV(`lich_su_xuat_nhap_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

// ----------------------------------------------------
// QUẢN LÝ NGƯỜI DÙNG (USER MANAGEMENT)
// ----------------------------------------------------
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
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản [${username}] không?`)) return;
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
