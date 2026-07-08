CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT UNIQUE NOT NULL,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'car', 'truck')),
  entry_time TEXT NOT NULL,
  exit_time TEXT DEFAULT NULL,
  amount REAL DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'parked' CHECK (status IN ('parked', 'exited'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_tickets_active_type ON tickets (vehicle_type, status);
CREATE INDEX IF NOT EXISTS idx_tickets_active_number ON tickets (vehicle_number, status);
CREATE INDEX IF NOT EXISTS idx_tickets_exit_time ON tickets (exit_time);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, is_active);