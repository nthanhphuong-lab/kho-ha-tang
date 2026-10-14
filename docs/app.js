// Quản lý trạng thái ứng dụng
let STATE = {
  devices: [],
  movements: [],
  categories: [],
  currentUser: null
};

// Khởi chạy khi mở trang
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

// Chuyển Tab giao diện
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
    categories: "Danh mục",
    users: "Quản trị người dùng"
  };
  document.getElementById("pageTitle").innerText = titles[viewId] || "Kho";

  if (viewId === "users") loadUsers();
}

// Đăng nhập
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

  // Ẩn/hiện các nút dành riêng cho Admin
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

// Tải dữ liệu từ Worker
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

// Dashboard
function renderDashboard() {
  document.getElementById("statTotalDevices").innerText = STATE.devices.length;
  document.getElementById("statInStock").innerText = STATE.devices.filter(d => d.status === "Trong kho").length;
  document.getElementById("statInUse").innerText = STATE.devices.filter(d => d.status === "Đang sử dụng").length;
  document.getElementById("statFaulty").innerText = STATE.devices.filter(d => (d.status || "").includes("Hỏng")).length;
}

// Danh sách thiết bị
function renderDevices() {
  const q = (document.getElementById("deviceSearch")?.value || "").toLowerCase();
  const filtered = STATE.devices.filter(d =>
    (d.code || "").toLowerCase().includes(q) ||
    (d.name || "").toLowerCase().includes(q) ||
    (d.location || "").toLowerCase().includes(q)
  );

  const tbody = document.getElementById("deviceTableBody");
  const isAdmin = STATE.currentUser?.role === "admin";

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td><b>${d.code}</b></td>
      <td>${d.name}</td>
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

// Lịch sử xuất/nhập
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

// Danh mục
function renderCategories() {
  const ul = document.getElementById("categoryList");
  ul.innerHTML = STATE.categories.map(c => `<li>${c}</li>`).join("");
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
    document.getElementById("devCategory").value = dev.category;
    document.getElementById("devLocation").value = dev.location || "";
    document.getElementById("devStatus").value = dev.status || "Trong kho";
  } else {
    document.getElementById("deviceModalTitle").innerText = "Thêm thiết bị mới";
    document.getElementById("devCode").value = "";
    document.getElementById("devCode").readOnly = false;
    document.getElementById("devName").value = "";
    document.getElementById("devLocation").value = "";
  }
}

function editDevice(code) {
  openDeviceModal(code);
}

async function handleSaveDevice(e) {
  e.preventDefault();
  const code = document.getElementById("devCode").value.trim();
  const name = document.getElementById("devName").value.trim();
  const category = document.getElementById("devCategory").value;
  const location = document.getElementById("devLocation").value.trim();
  const status = document.getElementById("devStatus").value;
  const isEdit = document.getElementById("devCode").readOnly;

  const action = isEdit ? "device.update" : "device.add";
  await callMutate(action, { code, name, category, location, status });
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
