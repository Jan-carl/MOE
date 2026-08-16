# Municipal Engineering LAN System

Full-stack LAN-based Municipal Engineering Office Management System with role-based access control.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite (`node:sqlite`)
- Auth: JWT + RBAC permission matrix

## Project Structure

- `frontend` - React web application
- `backend` - Express API + SQLite database

## Requirements

- Node.js 22+ (recommended)
- npm

## Setup

### 1) Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2) Initialize database

```bash
cd backend
npm run init-db
```

This creates `backend/database/municipal.db` and seeds:

- default admin user
- default office information
- default system settings
- default role permissions

### 3) Start backend API

```bash
cd backend
npm start
```

Backend runs on:

- `http://localhost:3001`
- `http://<your-local-ip>:3001` (LAN)

Health check:

- `GET /api/health`

### 4) Start frontend app

```bash
cd frontend
npm run dev
```

Frontend runs on:

- `http://localhost:5173`
- `http://<your-local-ip>:5173` (LAN)

The frontend is configured to call backend API at `/api` (proxied by Vite in dev mode).

## Default Login

- Username: `admin`
- Password: `admin123`

Change credentials immediately after first login.

## Main Modules

- Dashboard
- Client Management
- Permit Applications
- Payments / Official Receipt
- Reports
- Audit Logs
- User Management
- RBAC Matrix
- Settings (office, LAN config, backup/restore)

## Build Check

Frontend production build:

```bash
cd frontend
npm run build
```

Backend database init:

```bash
cd backend
npm run init-db
```

Both commands were verified successfully.
