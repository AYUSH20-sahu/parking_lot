import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    buildCsv,
    createUser,
    deleteUser,
    exitVehicleByIdentifier,
    getParkedVehicles,
    getReportSummary,
    getReports,
    getRevenueByDateRange,
    getRevenueToday,
    getRevenueTotal,
    getSettings,
    getSlots,
    getStatistics,
    getUserByUsername,
    hasParkedVehicleNumber,
    initializeDatabase,
    LIMITS,
    listUsers,
    parkVehicle,
    updateUser
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const clientDistPath = path.join(projectRoot, 'client', 'dist');

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const jwtSecret = process.env.JWT_SECRET || 'parking-lot-dev-secret';

app.use(cors());
app.use(express.json());

function isEmptyBody(body) {
    return !body || Object.keys(body).length === 0;
}

function normalizeVehicleType(value) {
    return String(value ?? '').trim().toLowerCase();
}

function normalizeVehicleNumber(value) {
    return String(value ?? '').trim().toUpperCase();
}

function signToken(user) {
    return jwt.sign({ sub: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '8h' });
}

function extractToken(req) {
    const authHeader = req.headers.authorization ?? '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        req.auth = jwt.verify(token, jwtSecret);
        return next();
    } catch {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.auth?.role !== role) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        return next();
    };
}

function normalizeDateOnly(value, endOfDay = false) {
    if (!value) {
        return null;
    }

    const datePart = String(value).slice(0, 10);
    return `${datePart}T${endOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}`;
}

app.post('/api/auth/login', (req, res) => {
    if (isEmptyBody(req.body)) {
        return res.status(400).json({ success: false, message: 'Request body is required' });
    }

    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = getUserByUsername(username);
    if (!user || !user.isActive || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user);
    return res.json({
        success: true,
        token,
        user: { username: user.username, role: user.role }
    });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    return res.json({
        success: true,
        user: { username: req.auth.username, role: req.auth.role }
    });
});

app.get('/api/slots', requireAuth, (_req, res) => {
    res.json(getSlots());
});

app.get('/api/parked', requireAuth, (req, res) => {
    res.json(getParkedVehicles(req.query.query ?? ''));
});

app.post('/api/park', requireAuth, (req, res) => {
    if (isEmptyBody(req.body)) {
        return res.status(400).json({ success: false, message: 'Request body is required' });
    }

    const vehicleNumber = normalizeVehicleNumber(req.body.vehicleNumber);
    const vehicleType = normalizeVehicleType(req.body.vehicleType);

    if (!vehicleNumber) {
        return res.status(400).json({ success: false, message: 'Vehicle number is required' });
    }

    if (!vehicleType) {
        return res.status(400).json({ success: false, message: 'Vehicle type is required' });
    }

    if (!Object.prototype.hasOwnProperty.call(LIMITS, vehicleType)) {
        return res.status(400).json({ success: false, message: 'Vehicle type must be bike, car, or truck' });
    }

    if (hasParkedVehicleNumber(vehicleNumber)) {
        return res.status(400).json({ success: false, message: 'Vehicle is already parked' });
    }

    if (getSlots()[vehicleType].available <= 0) {
        return res.status(409).json({ success: false, message: 'Parking Full' });
    }

    return res.status(201).json({ success: true, ticket: parkVehicle(vehicleNumber, vehicleType) });
});

app.post('/api/exit', requireAuth, (req, res) => {
    if (isEmptyBody(req.body)) {
        return res.status(400).json({ success: false, message: 'Request body is required' });
    }

    const ticketId = String(req.body.ticketId ?? '').trim().toUpperCase();
    const vehicleNumber = normalizeVehicleNumber(req.body.vehicleNumber);

    if (!ticketId && !vehicleNumber) {
        return res.status(400).json({ success: false, message: 'Ticket ID or vehicle number is required' });
    }

    const receipt = exitVehicleByIdentifier(ticketId || vehicleNumber);
    if (!receipt) {
        return res.status(404).json({ success: false, message: 'Ticket not found or already exited' });
    }

    return res.json({ success: true, receipt });
});

app.get('/api/admin/revenue/today', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ todayRevenue: getRevenueToday() });
});

app.get('/api/admin/revenue', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ totalRevenue: getRevenueTotal() });
});

app.get('/api/admin/statistics', requireAuth, requireRole('admin'), (_req, res) => {
    res.json(getStatistics());
});

app.get('/api/admin/settings', requireAuth, requireRole('admin'), (_req, res) => {
    res.json(getSettings());
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), (_req, res) => {
    res.json(listUsers());
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
    if (isEmptyBody(req.body)) {
        return res.status(400).json({ success: false, message: 'Request body is required' });
    }

    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? '');
    const role = String(req.body.role ?? '').trim().toLowerCase();

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Username, password, and role are required' });
    }

    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Role must be admin or user' });
    }

    try {
        const user = createUser({ username, password, role, isActive: req.body.isActive !== false });
        return res.status(201).json({ success: true, user });
    } catch {
        return res.status(400).json({ success: false, message: 'Username already exists' });
    }
});

app.put('/api/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
    const updated = updateUser(Number(req.params.id), req.body);
    if (!updated) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user: updated });
});

app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), (req, res) => {
    if (!deleteUser(Number(req.params.id))) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true });
});

app.get('/api/admin/reports', requireAuth, requireRole('admin'), (req, res) => {
    const filters = {
        from: normalizeDateOnly(req.query.from, false),
        to: normalizeDateOnly(req.query.to, true),
        query: req.query.query ?? ''
    };

    const items = getReports(filters);
    const summary = getReportSummary(filters);
    const start = filters.from ?? normalizeDateOnly(new Date().toISOString(), false);
    const end = filters.to ?? normalizeDateOnly(new Date().toISOString(), true);

    if (String(req.query.format ?? '').toLowerCase() === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="parking-reports.csv"');
        return res.send(buildCsv(items));
    }

    return res.json({ success: true, items, summary, revenueByDate: getRevenueByDateRange(start, end) });
});

if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

app.post('/api/auth/register', (req, res) => {
    if (isEmptyBody(req.body)) {
        return res.status(400).json({ success: false, message: 'Request body is required' });
    }

    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (username.length < 3) {
        return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    try {
        const user = createUser({
            username,
            password,
            role: 'user',
            isActive: true
        });

        const token = signToken(user);

        return res.status(201).json({
            success: true,
            token,
            user: { username: user.username, role: user.role }
        });
    } catch {
        return res.status(400).json({ success: false, message: 'Username already exists' });
    }
});

app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Not found' });
});

await initializeDatabase();

app.listen(port, () => {
    console.log(`Parking lot API running on http://localhost:${port}`);
});