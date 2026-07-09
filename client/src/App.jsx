import { useEffect, useMemo, useState } from 'react';

const AUTH_KEY = 'parking_lot_auth';

const ROUTES = {
    login: '/login',
    register: '/register',
    adminDashboard: '/admin/dashboard',
    adminRevenue: '/admin/revenue',
    adminReports: '/admin/reports',
    adminUsers: '/admin/users',
    userDashboard: '/user/dashboard',
    userPark: '/user/park',
    userExit: '/user/exit',
    userParked: '/user/parked'
};

const VEHICLE_TYPES = ['bike', 'car', 'truck'];

function getStoredAuth() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    } catch {
        return null;
    }
}

function setStoredAuth(auth) {
    if (!auth) {
        localStorage.removeItem(AUTH_KEY);
        return;
    }

    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, { token, ...options } = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message || 'Something went wrong');
    }

    return data;
}

function navigate(path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

function useRoute() {
    const [path, setPath] = useState(window.location.pathname || ROUTES.login);

    useEffect(() => {
        const onPopState = () => setPath(window.location.pathname || ROUTES.login);
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    return [path, setPath];
}

function typeLabel(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMoney(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function Sidebar({ role, activePath, onNavigate, onLogout }) {
    const items = role === 'admin'
        ? [
            ['Dashboard', ROUTES.adminDashboard],
            ['Revenue', ROUTES.adminRevenue],
            ['Reports', ROUTES.adminReports],
            ['Users', ROUTES.adminUsers],
            ['Park Vehicle', ROUTES.userPark],
            ['Exit Vehicle', ROUTES.userExit],
            ['Parked Vehicles', ROUTES.userParked]
        ]
        : [
            ['Dashboard', ROUTES.userDashboard],
            ['Park Vehicle', ROUTES.userPark],
            ['Exit Vehicle', ROUTES.userExit],
            ['Parked Vehicles', ROUTES.userParked]
        ];

    return (
        <aside className="sidebar">
            <div>
                <p className="sidebar__eyebrow">Parking lot</p>
                <h2>{role === 'admin' ? 'Admin' : 'Operator'} console</h2>
            </div>

            <nav className="sidebar__nav">
                {items.map(([label, path]) => (
                    <button
                        key={path}
                        type="button"
                        className={activePath === path ? 'nav-item nav-item--active' : 'nav-item'}
                        onClick={() => onNavigate(path)}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            <button type="button" className="nav-item nav-item--logout" onClick={onLogout}>
                Logout
            </button>
        </aside>
    );
}

function LoginPage({ onLogin, onOpenRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            onLogin({ token: data.token, user: data.user });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-shell">
            <section className="login-card">
                <p className="eyebrow">Parking lot management</p>
                <h1>Sign in to the role-based dashboard</h1>
                <p className="muted-copy">Sign in with your assigned account.</p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Username</span>
                        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                    </label>
                    <label>
                        <span>Password</span>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                    </label>
                    <button type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Login'}
                    </button>
                    <p className="status-banner status-banner--danger">{error}</p>
                </form>

                <div className="auth-switch">
                    <span>New operator?</span>
                    <button type="button" className="text-button" onClick={onOpenRegister}>Create account</button>
                </div>

            </section>
        </main>
    );
}

function RegisterPage({ onRegister, onOpenLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            onRegister({ token: data.token, user: data.user });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-shell">
            <section className="login-card">
                <p className="eyebrow">Parking lot management</p>
                <h1>Create user account</h1>
                <p className="muted-copy">Register as a data-entry user to access parking operations.</p>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Username</span>
                        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                    </label>
                    <label>
                        <span>Password</span>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                    </label>
                    <label>
                        <span>Confirm Password</span>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                    </label>
                    <button type="submit" disabled={loading}>
                        {loading ? 'Creating account...' : 'Register'}
                    </button>
                    <p className="status-banner status-banner--danger">{error}</p>
                </form>

                <div className="auth-switch">
                    <span>Already have an account?</span>
                    <button type="button" className="text-button" onClick={onOpenLogin}>Back to login</button>
                </div>
            </section>
        </main>
    );
}

function SlotCards({ slots }) {
    return (
        <section className="slot-grid">
            {VEHICLE_TYPES.map((type) => {
                const total = slots?.[type]?.total ?? 0;
                const available = slots?.[type]?.available ?? 0;
                const occupied = total - available;
                const pct = total === 0 ? 0 : (occupied / total) * 100;

                return (
                    <div key={type} className="card slot-card">
                        <div className="slot-card__top">
                            <h3>{typeLabel(type)}</h3>
                            <span>{available === 0 ? 'Full' : `${available} free`}</span>
                        </div>
                        <div className="slot-card__count">{occupied}</div>
                        <div className="meter"><span style={{ width: `${pct}%` }} /></div>
                    </div>
                );
            })}
        </section>
    );
}

function ParkingForm({ token, onCreated, slots, onRefresh, compact = false }) {
    const [vehicleNumber, setVehicleNumber] = useState('KA01AB1234');
    const [vehicleType, setVehicleType] = useState('car');
    const [message, setMessage] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        try {
            const data = await apiFetch('/api/park', {
                method: 'POST',
                token,
                body: JSON.stringify({ vehicleNumber, vehicleType })
            });

            onCreated(data.ticket);
            setMessage(`Ticket ${data.ticket.ticketId} generated.`);
            await onRefresh();
        } catch (err) {
            setMessage(err.message);
        }
    }

    return (
        <section className={`card form-card ${compact ? 'form-card--compact' : ''}`}>
            <h3>Park a vehicle</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
                <label>
                    <span>Vehicle number</span>
                    <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                </label>
                <label>
                    <span>Vehicle type</span>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                        {VEHICLE_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {typeLabel(type)}
                            </option>
                        ))}
                    </select>
                </label>
                <button type="submit">Generate ticket</button>
                <p className="status-banner status-banner--success">{message}</p>
            </form>
            {!compact && <SlotCards slots={slots} />}
        </section>
    );
}

function ExitForm({ token, onReceipt, onRefresh, compact = false }) {
    const [identifier, setIdentifier] = useState('TKT-1001');
    const [message, setMessage] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        const normalized = identifier.trim().toUpperCase();
        const body = normalized.startsWith('TKT-') ? { ticketId: normalized } : { vehicleNumber: identifier.trim() };

        try {
            const data = await apiFetch('/api/exit', {
                method: 'POST',
                token,
                body: JSON.stringify(body)
            });

            onReceipt(data.receipt);
            setMessage(`Receipt generated for ${data.receipt.ticketId}.`);
            await onRefresh();
        } catch (err) {
            setMessage(err.message);
        }
    }

    return (
        <section className={`card form-card ${compact ? 'form-card--compact' : ''}`}>
            <h3>Exit a vehicle</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
                <label>
                    <span>Ticket ID or vehicle number</span>
                    <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                </label>
                <button type="submit" className="secondary-button">
                    Exit and calculate fare
                </button>
                <p className="status-banner status-banner--success">{message}</p>
            </form>
        </section>
    );
}

function ParkedTable({ parked }) {
    return (
        <section className="card">
            <h3>Currently parked</h3>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Ticket ID</th>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th>Entry time</th>
                    </tr>
                </thead>
                <tbody>
                    {parked.length === 0 ? (
                        <tr>
                            <td colSpan={4}>No active vehicles.</td>
                        </tr>
                    ) : parked.map((row) => (
                        <tr key={row.ticketId}>
                            <td>{row.ticketId}</td>
                            <td>{row.vehicleNumber}</td>
                            <td>{typeLabel(row.vehicleType)}</td>
                            <td>{new Date(row.entryTime).toLocaleString('en-IN')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

function RevenuePage({ token }) {
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        (async () => {
            const [total, today, statData] = await Promise.all([
                apiFetch('/api/admin/revenue', { token }),
                apiFetch('/api/admin/revenue/today', { token }),
                apiFetch('/api/admin/statistics', { token })
            ]);

            setTotalRevenue(total.totalRevenue);
            setTodayRevenue(today.todayRevenue);
            setStats(statData);
        })().catch(() => { });
    }, [token]);

    const metrics = [
        ['Total Revenue', formatMoney(totalRevenue)],
        ['Today’s Revenue', formatMoney(todayRevenue)],
        ['Active Vehicles', String(stats?.activeVehicles ?? 0)],
        ['Occupancy', `${stats?.occupancy ?? 0}%`]
    ];

    return (
        <div className="dashboard-stack">
            <section className="hero-cards">
                {metrics.map(([label, value]) => (
                    <div key={label} className="card dashboard-metric">
                        <span>{label}</span>
                        <strong>{value}</strong>
                    </div>
                ))}
            </section>
            <section className="card">
                <h3>Revenue Notes</h3>
                <p className="muted-copy">Revenue is computed from exited tickets and stored exit times.</p>
            </section>
        </div>
    );
}

function ReportsPage({ token }) {
    const [data, setData] = useState(null);
    const [query, setQuery] = useState('');

    async function loadReports() {
        const params = new URLSearchParams();
        if (query.trim()) {
            params.set('query', query.trim());
        }

        const result = await apiFetch(`/api/admin/reports${params.toString() ? `?${params.toString()}` : ''}`, { token });
        setData(result);
    }

    useEffect(() => {
        loadReports().catch(() => { });
    }, []);

    async function exportCsv() {
        const response = await fetch(`/api/admin/reports?format=csv${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ''}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('CSV export failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'parking-reports.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="card">
            <div className="section-head">
                <div>
                    <h3>Parking history</h3>
                    <p className="muted-copy">Search exited tickets by ticket ID or vehicle number.</p>
                </div>
                <button type="button" className="secondary-button" onClick={() => exportCsv().catch(() => { })}>
                    Export CSV
                </button>
            </div>

            <label className="inline-field">
                <span>Search</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadReports()} />
            </label>

            <button type="button" onClick={() => loadReports().catch(() => { })}>Search</button>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>Ticket ID</th>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th>Duration</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {(data?.items || []).length === 0 ? (
                        <tr><td colSpan={5}>No history yet.</td></tr>
                    ) : (data?.items || []).map((row) => (
                        <tr key={row.ticketId}>
                            <td>{row.ticketId}</td>
                            <td>{row.vehicleNumber}</td>
                            <td>{typeLabel(row.vehicleType)}</td>
                            <td>{row.durationHours}h</td>
                            <td>{formatMoney(row.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

function UsersPage({ token }) {
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ username: '', password: '', role: 'user' });
    const [editingId, setEditingId] = useState(null);

    async function refreshUsers() {
        const data = await apiFetch('/api/admin/users', { token });
        setUsers(data);
    }

    useEffect(() => {
        refreshUsers().catch(() => { });
    }, []);

    async function create() {
        if (editingId) {
            await apiFetch(`/api/admin/users/${editingId}`, { token, method: 'PUT', body: JSON.stringify(form) });
        } else {
            await apiFetch('/api/admin/users', { token, method: 'POST', body: JSON.stringify(form) });
        }

        setForm({ username: '', password: '', role: 'user' });
        setEditingId(null);
        await refreshUsers();
    }

    async function toggleUser(user) {
        await apiFetch(`/api/admin/users/${user.id}`, {
            token,
            method: 'PUT',
            body: JSON.stringify({ isActive: !user.isActive })
        });
        await refreshUsers();
    }

    function beginEdit(user) {
        setEditingId(user.id);
        setForm({ username: user.username, password: '', role: user.role });
    }

    return (
        <section className="card">
            <h3>Users</h3>

            <div className="form-grid">
                <label>
                    <span>Username</span>
                    <input value={form.username} onChange={(e) => setForm((curr) => ({ ...curr, username: e.target.value }))} />
                </label>
                <label>
                    <span>Password</span>
                    <input type="password" value={form.password} onChange={(e) => setForm((curr) => ({ ...curr, password: e.target.value }))} />
                </label>
                <label>
                    <span>Role</span>
                    <select value={form.role} onChange={(e) => setForm((curr) => ({ ...curr, role: e.target.value }))}>
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                    </select>
                </label>
                <button type="button" onClick={() => create().catch(() => { })}>{editingId ? 'Save changes' : 'Create user'}</button>
            </div>

            <table className="data-table">
                <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.role}</td>
                            <td>{user.isActive ? 'Active' : 'Disabled'}</td>
                            <td>
                                <button type="button" onClick={() => beginEdit(user)}>Edit</button>
                                <button type="button" className="secondary-button" onClick={() => toggleUser(user).catch(() => { })}>
                                    {user.isActive ? 'Disable' : 'Enable'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

function DashboardPage({ token, slots, parked, onRefresh, onTicket, onReceipt }) {
    const stats = useMemo(() => {
        const total = Object.values(slots || {}).reduce((sum, item) => sum + (item.total || 0), 0);
        const active = Object.values(slots || {}).reduce((sum, item) => sum + ((item.total || 0) - (item.available || 0)), 0);
        return { total, active, occupancy: total ? Math.round((active / total) * 100) : 0 };
    }, [slots]);

    return (
        <div className="dashboard-stack">
            <section className="hero-cards">
                <div className="card dashboard-metric"><span>Active Parked Vehicles</span><strong>{stats.active}</strong></div>
                <div className="card dashboard-metric"><span>Occupancy Percentage</span><strong>{stats.occupancy}%</strong></div>
                <div className="card dashboard-metric"><span>Vehicle Types</span><strong>{parked.length}</strong></div>
                <div className="card dashboard-metric"><span>Slots</span><strong>{stats.total}</strong></div>
            </section>

            <SlotCards slots={slots} />

            <div className="content-grid">
                <ParkingForm token={token} onCreated={onTicket} slots={slots} onRefresh={onRefresh} compact />
                <ExitForm token={token} onReceipt={onReceipt} onRefresh={onRefresh} compact />
            </div>

            <ParkedTable parked={parked} />
        </div>
    );
}

function Shell({ role, token, activePath, slots, parked, onRefresh, onTicket, onReceipt, onNavigate, onLogout }) {
    const page = activePath || (role === 'admin' ? ROUTES.adminDashboard : ROUTES.userDashboard);
    let content = null;

    if (page === ROUTES.userPark) {
        content = <ParkingForm token={token} onCreated={onTicket} slots={slots} onRefresh={onRefresh} compact />;
    } else if (page === ROUTES.userExit) {
        content = <ExitForm token={token} onReceipt={onReceipt} onRefresh={onRefresh} compact />;
    } else if (page === ROUTES.userParked) {
        content = <ParkedTable parked={parked} />;
    } else if (page === ROUTES.adminRevenue) {
        content = <RevenuePage token={token} />;
    } else if (page === ROUTES.adminReports) {
        content = <ReportsPage token={token} />;
    } else if (page === ROUTES.adminUsers) {
        content = <UsersPage token={token} />;
    } else {
        content = <DashboardPage token={token} slots={slots} parked={parked} onRefresh={onRefresh} onTicket={onTicket} onReceipt={onReceipt} />;
    }

    return (
        <div className="app-frame">
            <Sidebar role={role} activePath={page} onNavigate={onNavigate} onLogout={onLogout} />
            <main className="main-content">{content}</main>
        </div>
    );
}

export default function App() {
    const [route, setRoute] = useRoute();
    const [auth, setAuth] = useState(getStoredAuth());
    const [slots, setSlots] = useState(null);
    const [parked, setParked] = useState([]);
    const [ticket, setTicket] = useState(null);
    const [receipt, setReceipt] = useState(null);

    async function refresh() {
        if (!auth?.token) {
            return;
        }

        const [slotData, parkedData] = await Promise.all([
            apiFetch('/api/slots', { token: auth.token }),
            apiFetch('/api/parked', { token: auth.token })
        ]);

        setSlots(slotData);
        setParked(parkedData);
    }

    useEffect(() => {
        if (!auth?.token) {
            if (route !== ROUTES.login && route !== ROUTES.register) {
                navigate(ROUTES.login);
            }
            return;
        }

        apiFetch('/api/auth/me', { token: auth.token })
            .then((data) => {
                if (data.user.role !== auth.user.role) {
                    const updated = { token: auth.token, user: data.user };
                    setAuth(updated);
                    setStoredAuth(updated);
                }

                refresh().catch(() => { });
                const target = data.user.role === 'admin' ? ROUTES.adminDashboard : ROUTES.userDashboard;
                if (!window.location.pathname.startsWith(`/${data.user.role}`)) {
                    navigate(target);
                }
            })
            .catch(() => {
                setAuth(null);
                setStoredAuth(null);
                navigate(ROUTES.login);
            });
    }, [auth?.token]);

    useEffect(() => {
        if (auth?.token) {
            refresh().catch(() => { });
        }
    }, [auth?.token]);

    function handleLogin(nextAuth) {
        setAuth(nextAuth);
        setStoredAuth(nextAuth);
        navigate(nextAuth.user.role === 'admin' ? ROUTES.adminDashboard : ROUTES.userDashboard);
    }

    function handleLogout() {
        setAuth(null);
        setStoredAuth(null);
        navigate(ROUTES.login);
    }

    if (!auth?.token) {
        if (route === ROUTES.register) {
            return <RegisterPage onRegister={handleLogin} onOpenLogin={() => navigate(ROUTES.login)} />;
        }

        return <LoginPage onLogin={handleLogin} onOpenRegister={() => navigate(ROUTES.register)} />;
    }

    return (
        <Shell
            role={auth.user.role}
            token={auth.token}
            activePath={route}
            slots={slots}
            parked={parked}
            onRefresh={refresh}
            onTicket={setTicket}
            onReceipt={setReceipt}
            onNavigate={(next) => {
                navigate(next);
                setRoute(next);
            }}
            onLogout={handleLogout}
        />
    );
}
