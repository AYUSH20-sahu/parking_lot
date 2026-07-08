# Parking Lot System

Full-stack parking lot mini-project with a Node.js API, a React dashboard, JWT auth, and a SQLite database.

## Stack

- Backend: Express + SQLite (`sql.js`)
- Frontend: React + Vite
- Database: SQLite

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app in development mode:

```bash
npm run dev
```

3. Open the frontend at the Vite URL shown in the terminal. The frontend talks to the API through a dev proxy.

## Default credentials

The app seeds these users on first run:

- Admin: `admin` / `password123`
- User: `operator1` / `password123`

## Login flow

- Sign in at `/login`
- Admin dashboard routes: `/admin/dashboard`, `/admin/revenue`, `/admin/reports`, `/admin/users`
- User routes: `/user/dashboard`, `/user/park`, `/user/exit`, `/user/parked`
- Shared parking APIs require a JWT in the `Authorization: Bearer <token>` header

## Default credentials

The database seeds two users on first run:

- Admin: `admin` / `password123`
- User: `operator1` / `password123`

## Scripts

- `npm run dev` - runs the API and frontend together
- `npm run server` - runs only the API
- `npm run build` - builds the React frontend
- `npm run start` - serves the API and built frontend from Express

## Database schema

The schema lives in [`schema.sql`](schema.sql).

## API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/slots`
- `POST /api/park`
- `POST /api/exit`
- `GET /api/parked`

Admin-only APIs:

- `GET /api/admin/revenue`
- `GET /api/admin/revenue/today`
- `GET /api/admin/statistics`
- `GET /api/admin/reports`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`

## Notes

- Slot limits are fixed in backend code: Bike 5, Car 5, Truck 2.
- Fare is calculated on the server from stored entry and exit timestamps.