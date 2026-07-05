# DigiPlay Server Documentation

This folder contains the complete Node.js server that runs both the **Express HTTP Web Dashboard** and the **Aedes MQTT Broker**. It acts as the single source of truth for the entire platform.

## 🧠 1. Server Architecture

```mermaid
sequenceDiagram
    participant Admin
    participant Server (Express)
    participant Database (Postgres)
    participant Broker (Aedes)
    participant ESP32
    
    Admin->>Server (Express): Logs in via /login (Session created)
    Admin->>Server (Express): Submits new text via /devices/push
    Server (Express)->>Database (Postgres): Saves new text to DB
    Server (Express)->>Broker (Aedes): Publishes text to MQTT Topic
    Broker (Aedes)->>ESP32: Instantly delivers message over TCP
```

## 📂 2. Directory Structure

```text
server/
├── index.js                 # Entry point: Injects secrets then boots server
├── server.js                # Core app: Express HTTP routes & MQTT Aedes broker
├── package.json             # NPM dependencies
├── src/
│   ├── auth.js              # Password hashing & Device Token generation
│   ├── create_admin.js      # CLI tool (npm run seed) to create admin accounts
│   ├── database.js          # Database connection setup
│   ├── load_secrets.js      # AWS Secrets Manager loader
│   └── models.js            # Sequelize tables (Admins, Devices)
├── templates/               # Nunjucks HTML templates for Web Dashboard
│   ├── dashboard.html
│   ├── devices.html
│   └── login.html
└── static/                  # CSS stylesheets
    └── style.css
```

## 🛠️ 3. Key Technologies
- **Node.js & Express 5.x**: Powers the Web Dashboard backend.
- **Express-Session**: Keeps the admin securely logged in across pages using a browser cookie (MemoryStore).
- **Sequelize ORM**: Manages the PostgreSQL database tables without writing raw SQL.
- **Aedes**: A lightweight, blazing-fast MQTT broker embedded directly inside our Node.js app!

## 💾 4. Database Schema (PostgreSQL)

The server relies on two tables managed by Sequelize:

### **Admins Table**
- `id`: Integer (Primary Key, Auto-increment)
- `username`: String (Unique)
- `password_hash`: Text (Bcrypt Hashed)

### **Devices Table**
- `id`: String (Primary Key, UUID)
- `name`: String
- `description`: Text
- `device_token`: String (SHA256 hashed to prevent leaks)
- `current_content`: Text (The string currently displayed on the OLED)
- `is_online`: Boolean (Real-time tracking of MQTT connection presence)

## 🔐 5. Security Features

1. **Dashboard Protection**: Every page (like `/dashboard` and `/devices`) is protected by server-side middleware. If you don't have a valid session cookie, you are kicked back to `/login`.
2. **Hardware Protection**: The MQTT broker requires a specific `Username` (Device ID) and `Password` (Device Token). Random internet bots cannot connect to your broker.
3. **Database Security**: All passwords and tokens are irreversibly hashed before being saved to the database.

## ⚙️ 6. Environment Variables (`.env`)

The server requires the following configuration to boot:

```env
# The connection string to your PostgreSQL Database
DATABASE_URL=postgresql://digiplay:strongpassword@localhost:5432/digiplay_db

# A long random string used to sign Session Cookies securely
SECRET_KEY=some_random_secret_string

# For AWS Production Mode:
USE_AWS_SECRETS=true
AWS_REGION=us-east-1
AWS_SECRET_NAME=digiplay/production/env
```

## 🚀 7. Installation

```bash
# 1. Install dependencies
npm install

# 2. Seed Admin user
npm run seed

# 3. Start the server
npm start
# OR for development
npm run dev
```

## ⚠️ 8. Common Problems

- **"ReferenceError: Cannot access 'app' before initialization"**: This happens if you accidentally place Express code before `const app = express();` is declared in `server.js`.
- **Admin user 'admin' already exists**: When running `npm run seed`, the database refuses to overwrite an existing admin. Run `node src/create_admin.js new_name new_password` to safely make a fresh account.
- **Session drops after server restart**: Because `express-session` uses RAM (MemoryStore) by default, restarting the server destroys all active logins. You must log in again, and you must hard-refresh your browser cache.
