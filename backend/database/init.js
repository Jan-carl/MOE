const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'municipal.db');
const db = new DatabaseSync(dbPath);

console.log('Initializing SQLite Database schema...');

// Create required tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'engineering_staff', 'cashier', 'municipal_engineer', 'viewer')),
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE,
    full_name TEXT NOT NULL,
    contact_number TEXT,
    email TEXT,
    address TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permit_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id TEXT UNIQUE,
    client_id INTEGER REFERENCES clients(id),
    permit_type TEXT NOT NULL CHECK(permit_type IN ('building', 'electrical', 'occupancy', 'locational', 'certificate')),
    location_address TEXT NOT NULL,
    project_title TEXT NOT NULL,
    estimated_cost REAL DEFAULT 0,
    status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'for_review', 'for_payment', 'for_approval', 'approved', 'released', 'rejected')),
    assigned_staff_id INTEGER REFERENCES users(id),
    engineer_approval INTEGER DEFAULT 0,
    notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requirements_checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER REFERENCES permit_applications(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    is_submitted INTEGER DEFAULT 0,
    remarks TEXT
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE,
    application_id INTEGER REFERENCES permit_applications(id),
    client_id INTEGER REFERENCES clients(id),
    or_number TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    fee_type TEXT NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    cashier_id INTEGER REFERENCES users(id),
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT UNIQUE NOT NULL,
    admin INTEGER DEFAULT 1,
    engineering_staff INTEGER DEFAULT 0,
    cashier INTEGER DEFAULT 0,
    municipal_engineer INTEGER DEFAULT 1,
    viewer INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS office_info (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    office_name TEXT DEFAULT 'Municipal Engineering Office',
    municipality TEXT DEFAULT 'Gumaca, Quezon',
    address TEXT,
    contact_number TEXT,
    email TEXT,
    municipal_engineer TEXT
  );
`);

// Role Permissions Seed with balanced Municipal Engineer Access
// (users, settings, rbac are strictly reserved for System Administrator)
const modules = [
  { module: 'dashboard', admin: 1, engineering_staff: 1, cashier: 1, municipal_engineer: 1, viewer: 1 },
  { module: 'clients', admin: 1, engineering_staff: 1, cashier: 0, municipal_engineer: 1, viewer: 1 },
  { module: 'permits', admin: 1, engineering_staff: 1, cashier: 0, municipal_engineer: 1, viewer: 0 },
  { module: 'payments', admin: 1, engineering_staff: 0, cashier: 1, municipal_engineer: 1, viewer: 0 },
  { module: 'reports', admin: 1, engineering_staff: 1, cashier: 1, municipal_engineer: 1, viewer: 1 },
  { module: 'audit_logs', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 1, viewer: 0 },
  { module: 'users', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 0, viewer: 0 }, // Admin only
  { module: 'settings', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 0, viewer: 0 }, // Admin only
  { module: 'rbac', admin: 1, engineering_staff: 0, cashier: 0, municipal_engineer: 0, viewer: 0 }, // Admin only
];

const upsertPerm = db.prepare(`
  INSERT INTO role_permissions (module, admin, engineering_staff, cashier, municipal_engineer, viewer)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(module) DO UPDATE SET
    admin = excluded.admin,
    engineering_staff = excluded.engineering_staff,
    cashier = excluded.cashier,
    municipal_engineer = excluded.municipal_engineer,
    viewer = excluded.viewer
`);

for (const m of modules) {
  upsertPerm.run(m.module, m.admin, m.engineering_staff, m.cashier, m.municipal_engineer, m.viewer);
}

const demoUsers = [
  { username: 'admin', pass: 'admin123', name: 'System Administrator', role: 'admin', id: 'USR-001' },
  { username: 'engineer', pass: 'engineer123', name: 'Engr. Juan Dela Cruz', role: 'municipal_engineer', id: 'USR-002' },
  { username: 'staff', pass: 'staff123', name: 'Engr. Maria Santos', role: 'engineering_staff', id: 'USR-003' },
  { username: 'cashier', pass: 'cashier123', name: 'Ana Reyes', role: 'cashier', id: 'USR-004' },
  { username: 'viewer', pass: 'viewer123', name: 'Pedro Penduko', role: 'viewer', id: 'USR-005' },
];

for (const u of demoUsers) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
  if (!exists) {
    const hash = bcrypt.hashSync(u.pass, 10);
    db.prepare(`
      INSERT INTO users (user_id, username, password, full_name, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(u.id, u.username, hash, u.name, u.role);
    console.log(`Default ${u.role} created: username=${u.username}, password=${u.pass}`);
  }
}

const officeExists = db.prepare('SELECT id FROM office_info WHERE id = 1').get();
if (!officeExists) {
  db.prepare(`
    INSERT INTO office_info (id, office_name, municipality, address, contact_number, email, municipal_engineer)
    VALUES (1, 'Municipal Engineering Office', 'Gumaca, Quezon', 'Municipal Hall, Gumaca, Quezon', '(042) 123-4567', 'engineering@gumaca.gov.ph', 'Engr. Juan Dela Cruz')
  `).run();
}

const defaultSettings = {
  server_name: 'MEO-SERVER',
  local_ip: '192.168.1.100',
  subnet_mask: '255.255.255.0',
  gateway: '192.168.1.1',
  permit_fee_building: '5000',
  permit_fee_electrical: '2000',
  permit_fee_occupancy: '1500',
  permit_fee_locational: '1000',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(defaultSettings)) {
  insertSetting.run(k, v);
}

console.log('Database schema & balanced Municipal Engineer permissions updated successfully.');
