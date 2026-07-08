import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { calculateDurationHours } from './pricing.js';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(__dirname, 'data', 'parking.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const schemaSql = fs.readFileSync(path.join(projectRoot, 'schema.sql'), 'utf8');

export const LIMITS = { bike: 5, car: 5, truck: 2 };
export const PRICING = [
    { maxHours: 3, amount: 30 },
    { maxHours: 6, amount: 85 },
    { maxHours: Infinity, amount: 120 }
];

const DEFAULT_USERS = [
    { username: 'admin', password: 'password123', role: 'admin' },
    { username: 'operator1', password: 'password123', role: 'user' }
];

let db;

function ensureDb() {
    if (!db) {
        throw new Error('Database has not been initialized');
    }

    return db;
}

function saveDatabase() {
    const database = ensureDb();
    fs.writeFileSync(dbPath, Buffer.from(database.export()));
}

function queryAll(sql, params = []) {
    const statement = ensureDb().prepare(sql);
    statement.bind(params);
    const rows = [];

    while (statement.step()) {
        rows.push(statement.getAsObject());
    }

    statement.free();
    return rows;
}

function queryOne(sql, params = []) {
    return queryAll(sql, params)[0] ?? null;
}

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function seedUsers() {
    const count = Number(queryOne('SELECT COUNT(*) AS count FROM users')?.count ?? 0);
    if (count > 0) {
        return;
    }

    const statement = ensureDb().prepare('INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, ?)');
    for (const user of DEFAULT_USERS) {
        statement.run([user.username, hashPassword(user.password), user.role, 1]);
    }
    statement.free();
}

export async function initializeDatabase() {
    if (db) {
        return db;
    }

    const SQL = await initSqlJs({
        locateFile: (file) => path.join(path.dirname(wasmPath), file)
    });

    if (fs.existsSync(dbPath)) {
        db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON;');
    db.run(schemaSql);
    seedUsers();
    saveDatabase();
    return db;
}

export function withTransaction(callback) {
    const database = ensureDb();
    database.run('BEGIN');

    try {
        const result = callback(database);
        database.run('COMMIT');
        saveDatabase();
        return result;
    } catch (error) {
        database.run('ROLLBACK');
        throw error;
    }
}

export function getSlots() {
    const rows = queryAll(
        `SELECT vehicle_type, COUNT(*) AS occupied
     FROM tickets
     WHERE status = 'parked'
     GROUP BY vehicle_type`
    );

    const occupiedByType = Object.fromEntries(rows.map((row) => [row.vehicle_type, row.occupied]));

    return {
        bike: { total: LIMITS.bike, available: Math.max(0, LIMITS.bike - (occupiedByType.bike ?? 0)) },
        car: { total: LIMITS.car, available: Math.max(0, LIMITS.car - (occupiedByType.car ?? 0)) },
        truck: { total: LIMITS.truck, available: Math.max(0, LIMITS.truck - (occupiedByType.truck ?? 0)) }
    };
}

export function getParkedVehicles(query = '') {
    const normalized = String(query ?? '').trim().toLowerCase();
    if (normalized) {
        return queryAll(
            `SELECT ticket_id AS ticketId,
              vehicle_number AS vehicleNumber,
              vehicle_type AS vehicleType,
              entry_time AS entryTime
       FROM tickets
       WHERE status = 'parked'
         AND (LOWER(ticket_id) LIKE ? OR LOWER(vehicle_number) LIKE ?)
       ORDER BY entry_time ASC, id ASC`,
            [`%${normalized}%`, `%${normalized}%`]
        );
    }

    return queryAll(
        `SELECT ticket_id AS ticketId,
            vehicle_number AS vehicleNumber,
            vehicle_type AS vehicleType,
            entry_time AS entryTime
     FROM tickets
     WHERE status = 'parked'
     ORDER BY entry_time ASC, id ASC`
    );
}

export function findParkedTicket(identifier) {
    const normalized = String(identifier).trim();
    if (!normalized) {
        return null;
    }

    const isTicketId = normalized.toUpperCase().startsWith('TKT-');
    return queryOne(
        isTicketId
            ? `SELECT * FROM tickets WHERE ticket_id = ? AND status = 'parked' LIMIT 1`
            : `SELECT * FROM tickets WHERE vehicle_number = ? AND status = 'parked' LIMIT 1`,
        [normalized]
    );
}

export function hasParkedVehicleNumber(vehicleNumber) {
    return Boolean(queryOne(`SELECT 1 FROM tickets WHERE vehicle_number = ? AND status = 'parked' LIMIT 1`, [vehicleNumber]));
}

export function parkVehicle(vehicleNumber, vehicleType) {
    const entryTime = new Date().toISOString();

    return withTransaction((database) => {
        database.prepare(
            `INSERT INTO tickets (ticket_id, vehicle_number, vehicle_type, entry_time, status)
       VALUES (?, ?, ?, ?, 'parked')`
        ).run(['PENDING', vehicleNumber, vehicleType, entryTime]);

        const rowId = Number(database.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
        const ticketId = `TKT-${1000 + rowId}`;
        database.prepare('UPDATE tickets SET ticket_id = ? WHERE id = ?').run([ticketId, rowId]);

        return { ticketId, vehicleNumber, vehicleType, entryTime };
    });
}

export function exitVehicleByIdentifier(identifier) {
    const parkedTicket = findParkedTicket(identifier);
    if (!parkedTicket) {
        return null;
    }

    const exitTime = new Date().toISOString();
    const durationHours = calculateDurationHours(parkedTicket.entry_time, exitTime);
    const amount = durationHours <= 3 ? 30 : durationHours <= 6 ? 85 : 120;

    return withTransaction((database) => {
        database.prepare(
            `UPDATE tickets
       SET exit_time = ?, amount = ?, status = 'exited'
       WHERE id = ?`
        ).run([exitTime, amount, parkedTicket.id]);

        return {
            ticketId: parkedTicket.ticket_id,
            vehicleNumber: parkedTicket.vehicle_number,
            vehicleType: parkedTicket.vehicle_type,
            entryTime: parkedTicket.entry_time,
            exitTime,
            durationHours,
            amount
        };
    });
}

export function getRevenueTotal() {
    return Number(queryOne(`SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM tickets WHERE status = 'exited'`)?.totalRevenue ?? 0);
}

export function getRevenueToday() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return Number(
        queryOne(
            `SELECT COALESCE(SUM(amount), 0) AS todayRevenue
       FROM tickets
       WHERE status = 'exited'
         AND exit_time >= ?
         AND exit_time < ?`,
            [start.toISOString(), end.toISOString()]
        )?.todayRevenue ?? 0
    );
}

export function getStatistics() {
    const slots = getSlots();
    const activeVehicles = Object.values(slots).reduce((sum, item) => sum + (item.total - item.available), 0);
    const totalSlots = Object.values(slots).reduce((sum, item) => sum + item.total, 0);
    const occupancy = totalSlots === 0 ? 0 : Math.round((activeVehicles / totalSlots) * 100);

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const todayExits = Number(
        queryOne(
            `SELECT COUNT(*) AS count
       FROM tickets
       WHERE status = 'exited'
         AND exit_time >= ?
         AND exit_time < ?`,
            [start.toISOString(), end.toISOString()]
        )?.count ?? 0
    );

    return {
        activeVehicles,
        todayExits,
        occupancy,
        bikeCount: slots.bike.total - slots.bike.available,
        carCount: slots.car.total - slots.car.available,
        truckCount: slots.truck.total - slots.truck.available
    };
}

export function getRevenueByDateRange(startDate, endDate) {
    return queryAll(
        `SELECT substr(exit_time, 1, 10) AS date,
            COALESCE(SUM(amount), 0) AS amount,
            COUNT(*) AS exits
     FROM tickets
     WHERE status = 'exited'
       AND exit_time >= ?
       AND exit_time < ?
     GROUP BY substr(exit_time, 1, 10)
     ORDER BY date ASC`,
        [startDate, endDate]
    ).map((row) => ({ date: row.date, amount: Number(row.amount), exits: Number(row.exits) }));
}

export function getReports({ from, to, query = '' } = {}) {
    const now = new Date();
    const start = from ? new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = to ? new Date(`${String(to).slice(0, 10)}T23:59:59.999Z`) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const normalized = String(query ?? '').trim().toLowerCase();

    const sql =
        `SELECT ticket_id AS ticketId,
            vehicle_number AS vehicleNumber,
            vehicle_type AS vehicleType,
            entry_time AS entryTime,
            exit_time AS exitTime,
            amount,
            status
     FROM tickets
     WHERE exit_time IS NOT NULL
       AND exit_time >= ?
       AND exit_time < ?`;

    const rows = normalized
        ? queryAll(
            `${sql}
         AND (LOWER(ticket_id) LIKE ? OR LOWER(vehicle_number) LIKE ?)
         ORDER BY exit_time DESC, id DESC`,
            [start.toISOString(), end.toISOString(), `%${normalized}%`, `%${normalized}%`]
        )
        : queryAll(`${sql} ORDER BY exit_time DESC, id DESC`, [start.toISOString(), end.toISOString()]);

    return rows.map((row) => ({
        ticketId: row.ticketId,
        vehicleNumber: row.vehicleNumber,
        vehicleType: row.vehicleType,
        entryTime: row.entryTime,
        exitTime: row.exitTime,
        amount: Number(row.amount),
        status: row.status,
        durationHours: calculateDurationHours(row.entryTime, row.exitTime)
    }));
}

export function getReportSummary(filters = {}) {
    const items = getReports(filters);
    return {
        count: items.length,
        totalRevenue: items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    };
}

export function listUsers() {
    return queryAll(
        `SELECT id,
            username,
            role,
            is_active AS isActive
     FROM users
     ORDER BY id ASC`
    ).map((row) => ({ id: row.id, username: row.username, role: row.role, isActive: Boolean(row.isActive) }));
}

export function getUserByUsername(username) {
    return queryOne(
        `SELECT id,
            username,
            password,
            role,
            is_active AS isActive
     FROM users
     WHERE username = ?
     LIMIT 1`,
        [username]
    );
}

export function getUserById(id) {
    return queryOne(
        `SELECT id,
            username,
            password,
            role,
            is_active AS isActive
     FROM users
     WHERE id = ?
     LIMIT 1`,
        [id]
    );
}

export function createUser({ username, password, role, isActive = true }) {
    return withTransaction((database) => {
        database.prepare(
            `INSERT INTO users (username, password, role, is_active)
       VALUES (?, ?, ?, ?)`
        ).run([String(username).trim(), hashPassword(password), role, isActive ? 1 : 0]);

        const rowId = Number(database.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
        return getUserById(rowId);
    });
}

export function updateUser(id, changes = {}) {
    const current = getUserById(id);
    if (!current) {
        return null;
    }

    const nextUsername = changes.username ? String(changes.username).trim() : current.username;
    const nextRole = changes.role ? String(changes.role).trim().toLowerCase() : current.role;
    const nextPassword = changes.password ? hashPassword(changes.password) : current.password;
    const nextActive = changes.isActive === undefined ? Boolean(current.isActive) : Boolean(changes.isActive);

    withTransaction((database) => {
        database.prepare(
            `UPDATE users
       SET username = ?, password = ?, role = ?, is_active = ?
       WHERE id = ?`
        ).run([nextUsername, nextPassword, nextRole, nextActive ? 1 : 0, id]);
    });

    return getUserById(id);
}

export function deleteUser(id) {
    if (!getUserById(id)) {
        return false;
    }

    withTransaction((database) => {
        database.prepare('DELETE FROM users WHERE id = ?').run([id]);
    });

    return true;
}

export function getSettings() {
    return { limits: LIMITS, pricing: PRICING };
}

export function buildCsv(rows) {
    const headers = ['ticketId', 'vehicleNumber', 'vehicleType', 'entryTime', 'exitTime', 'durationHours', 'amount'];
    const escapeValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(','))].join('\n');
}