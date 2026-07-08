'use strict';

/* ---------- Almacenamiento (todo vive en este navegador/dispositivo) ---------- */

const STORAGE_KEYS = {
  employees: 'fichaje_employees',
  records: 'fichaje_records',
  adminHash: 'fichaje_admin_hash',
};

const DEFAULT_ADMIN_PASSWORD = 'admin1234';

function loadEmployees() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.employees) || '[]');
}
function saveEmployees(list) {
  localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(list));
}
function loadRecords() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.records) || '[]');
}
function saveRecords(list) {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(list));
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getAdminHash() {
  let hash = localStorage.getItem(STORAGE_KEYS.adminHash);
  if (!hash) {
    hash = await sha256Hex(DEFAULT_ADMIN_PASSWORD);
    localStorage.setItem(STORAGE_KEYS.adminHash, hash);
  }
  return hash;
}

/* ---------- Avatares: iniciales y color determinista por nombre ---------- */

const AVATAR_COLORS = ['#2e5899', '#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#4d7c0f', '#be123c', '#525252'];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return initials.toUpperCase();
}

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/* ---------- Utilidades de fecha/hora ---------- */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/* ---------- Lógica de fichajes ---------- */

function findOpenRecord(employee) {
  const records = loadRecords();
  return records.find(r => r.employee === employee && r.end === null) || null;
}

function startShift(employee) {
  const records = loadRecords();
  if (findOpenRecord(employee)) return;
  records.push({
    id: crypto.randomUUID(),
    employee,
    date: todayISO(),
    start: Date.now(),
    end: null,
  });
  saveRecords(records);
}

function endShift(employee) {
  const records = loadRecords();
  const open = records.find(r => r.employee === employee && r.end === null);
  if (!open) return;
  open.end = Date.now();
  saveRecords(records);
}

function employeeRecords(employee, limit) {
  const records = loadRecords()
    .filter(r => r.employee === employee)
    .sort((a, b) => b.start - a.start);
  return limit ? records.slice(0, limit) : records;
}

/* Agrupa sesiones por empleado+día: entrada = primera, salida = última, total = suma de duraciones */
function groupedDailyRecords({ employee = '', from = '', to = '' } = {}) {
  const records = loadRecords().filter(r => {
    if (employee && r.employee !== employee) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  });

  const groups = new Map();
  for (const r of records) {
    const key = `${r.employee}|${r.date}`;
    if (!groups.has(key)) {
      groups.set(key, { employee: r.employee, date: r.date, sessions: [] });
    }
    groups.get(key).sessions.push(r);
  }

  return Array.from(groups.values())
    .map(g => {
      const totalMs = g.sessions.reduce((sum, s) => sum + ((s.end ?? Date.now()) - s.start), 0);
      return { ...g, totalMs };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.employee.localeCompare(b.employee)));
}

/* ---------- Navegación entre vistas ---------- */

const views = ['home', 'employee', 'admin-login', 'admin'];
let currentEmployee = null;
let adminAuthed = false;

function showView(name) {
  for (const v of views) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
}

/* ---------- Render: pantalla de personal ---------- */

function renderHome() {
  const grid = document.getElementById('employee-grid');
  const emptyMsg = document.getElementById('home-empty-msg');
  const employees = loadEmployees();
  grid.innerHTML = '';
  emptyMsg.hidden = employees.length > 0;

  for (const name of employees) {
    const btn = document.createElement('button');
    btn.className = 'employee-btn';
    const isClockedIn = Boolean(findOpenRecord(name));
    if (isClockedIn) btn.classList.add('clocked-in');

    const avatar = document.createElement('span');
    avatar.className = 'avatar avatar-md';
    avatar.style.background = colorForName(name);
    avatar.textContent = getInitials(name);

    const label = document.createElement('span');
    label.textContent = name;
    if (isClockedIn) {
      const dot = document.createElement('span');
      dot.className = 'employee-status-dot';
      label.appendChild(dot);
    }

    btn.append(avatar, label);
    btn.addEventListener('click', () => openEmployee(name));
    grid.appendChild(btn);
  }
}

function openEmployee(name) {
  currentEmployee = name;
  document.getElementById('employee-name').textContent = name;
  const avatar = document.getElementById('employee-avatar');
  avatar.textContent = getInitials(name);
  avatar.style.background = colorForName(name);
  renderEmployeeView();
  showView('employee');
}

function renderEmployeeView() {
  const open = findOpenRecord(currentEmployee);
  const status = document.getElementById('employee-status');
  const btnStart = document.getElementById('btn-start');
  const btnEnd = document.getElementById('btn-end');

  if (open) {
    status.textContent = `Jornada iniciada a las ${formatTime(open.start)}`;
    btnStart.hidden = true;
    btnEnd.hidden = false;
  } else {
    const todaySessions = employeeRecords(currentEmployee).filter(r => r.date === todayISO());
    if (todaySessions.length > 0) {
      const lastEnd = Math.max(...todaySessions.map(r => r.end));
      status.textContent = `En pausa desde las ${formatTime(lastEnd)}. Pulsa "Iniciar jornada" al volver.`;
    } else {
      status.textContent = 'No has iniciado jornada hoy.';
    }
    btnStart.hidden = false;
    btnEnd.hidden = true;
  }

  renderEmployeeHistory();
}

function renderEmployeeHistory() {
  const wrap = document.getElementById('employee-history');
  const grouped = groupedDailyRecords({ employee: currentEmployee }).slice(0, 10);

  if (grouped.length === 0) {
    wrap.innerHTML = '<p class="empty-msg">Todavía no hay fichajes.</p>';
    return;
  }

  wrap.innerHTML = buildHistoryTable(grouped, { showEmployee: false });
}

/* ---------- Render: tabla común ---------- */

function buildSessionsCell(g) {
  const sessions = g.sessions.slice().sort((a, b) => a.start - b.start);
  let html = '';
  sessions.forEach((s, i) => {
    const endLabel = s.end === null ? '<span class="tag-open">En curso</span>' : formatTime(s.end);
    html += `<span class="session-pair">${formatTime(s.start)}–${endLabel}</span>`;
    if (i < sessions.length - 1) {
      const gapMs = sessions[i + 1].start - s.end;
      html += `<span class="session-break">pausa de ${formatDuration(gapMs)}</span>`;
    }
  });
  return html;
}

function buildHistoryTable(grouped, { showEmployee }) {
  const rows = grouped.map(g => `
    <tr>
      ${showEmployee ? `<td>${escapeHtml(g.employee)}</td>` : ''}
      <td>${formatDate(g.date)}</td>
      <td class="sessions-td"><div class="sessions-cell">${buildSessionsCell(g)}</div></td>
      <td>${formatDuration(g.totalMs)}</td>
    </tr>
  `).join('');

  return `
    <table class="history-table">
      <thead>
        <tr>
          ${showEmployee ? '<th>Empleado</th>' : ''}
          <th>Fecha</th>
          <th>Fichajes</th>
          <th>Horas totales</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Admin: login ---------- */

async function tryAdminLogin(password) {
  const hash = await sha256Hex(password);
  const stored = await getAdminHash();
  return hash === stored;
}

/* ---------- Admin: panel ---------- */

function renderAdminEmployeeFilter() {
  const select = document.getElementById('filter-employee');
  const current = select.value;
  select.innerHTML = '<option value="">Todos</option>' +
    loadEmployees().map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.value = current;
}

function renderAdminTable() {
  const employee = document.getElementById('filter-employee').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const grouped = groupedDailyRecords({ employee, from, to });
  const wrap = document.getElementById('admin-table-wrap');

  if (grouped.length === 0) {
    wrap.innerHTML = '<p class="empty-msg">No hay fichajes para este filtro.</p>';
    return;
  }
  wrap.innerHTML = buildHistoryTable(grouped, { showEmployee: true });
}

function exportCsv() {
  const employee = document.getElementById('filter-employee').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const grouped = groupedDailyRecords({ employee, from, to });

  const header = 'Empleado,Fecha,Fichajes,Horas totales\n';
  const lines = grouped.map(g => {
    const sessions = g.sessions.slice().sort((a, b) => a.start - b.start)
      .map(s => `${formatTime(s.start)}-${s.end === null ? 'En curso' : formatTime(s.end)}`)
      .join(' / ');
    return [g.employee, formatDate(g.date), `"${sessions}"`, formatDuration(g.totalMs)].join(',');
  });

  const csv = header + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fichajes_${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderEmployeeManageList() {
  const list = document.getElementById('employee-manage-list');
  const employees = loadEmployees();
  list.innerHTML = employees.map(name => `
    <li>
      <span>${escapeHtml(name)}</span>
      <button data-remove="${escapeHtml(name)}">Eliminar</button>
    </li>
  `).join('') || '<li>No hay personal dado de alta.</li>';

  list.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-remove');
      if (!confirm(`¿Eliminar a "${name}" de la lista de personal? Su histórico de fichajes se conservará.`)) return;
      saveEmployees(loadEmployees().filter(n => n !== name));
      renderEmployeeManageList();
      renderAdminEmployeeFilter();
      renderHome();
    });
  });
}

function openAdminPanel() {
  adminAuthed = true;
  renderAdminEmployeeFilter();
  renderAdminTable();
  renderEmployeeManageList();
  showView('admin');
}

/* ---------- Eventos ---------- */

document.addEventListener('DOMContentLoaded', () => {
  renderHome();

  document.getElementById('btn-admin-link').addEventListener('click', () => {
    if (adminAuthed) {
      openAdminPanel();
    } else {
      document.getElementById('admin-login-error').hidden = true;
      document.getElementById('admin-password').value = '';
      showView('admin-login');
    }
  });

  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.getAttribute('data-back')));
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    startShift(currentEmployee);
    renderEmployeeView();
    renderHome();
  });

  document.getElementById('btn-end').addEventListener('click', () => {
    endShift(currentEmployee);
    renderEmployeeView();
    renderHome();
  });

  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    const ok = await tryAdminLogin(password);
    if (ok) {
      openAdminPanel();
    } else {
      document.getElementById('admin-login-error').hidden = false;
    }
  });

  document.getElementById('btn-admin-logout').addEventListener('click', () => {
    adminAuthed = false;
    showView('home');
    renderHome();
  });

  document.getElementById('btn-filter').addEventListener('click', renderAdminTable);
  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);

  document.getElementById('add-employee-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-employee-name');
    const name = input.value.trim();
    if (!name) return;
    const employees = loadEmployees();
    if (employees.includes(name)) {
      alert('Ese nombre ya existe en la lista.');
      return;
    }
    employees.push(name);
    saveEmployees(employees);
    input.value = '';
    renderEmployeeManageList();
    renderAdminEmployeeFilter();
    renderHome();
  });

  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    const msg = document.getElementById('change-password-msg');
    const ok = await tryAdminLogin(current);
    if (!ok) {
      msg.textContent = 'La contraseña actual no es correcta.';
      msg.hidden = false;
      return;
    }
    localStorage.setItem(STORAGE_KEYS.adminHash, await sha256Hex(next));
    msg.textContent = 'Contraseña actualizada.';
    msg.style.color = 'var(--color-start)';
    msg.hidden = false;
    e.target.reset();
  });
});
