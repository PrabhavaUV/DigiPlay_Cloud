# DigiPlay – IoT-Based Remote Digital Name Display System
# `server.md` — Backend Server & Web Dashboard

---

## 1. System Overview

DigiPlay is an IoT platform enabling remote control of ESP32-based digital name display devices. The Node.js central server acts as the **single source of truth** — managing device registration, content update requests, admin approvals, and serving approved content to devices via AWS IoT Core.

## 2. Technology Stack

- **Runtime Environment:** Node.js (v18+)
- **Backend Framework:** Express.js
- **Database Layer:** PostgreSQL (via Sequelize ORM) for persistent storage.
- **Communication Protocol:** MQTT via AWS IoT Core (using `@aws-sdk/client-iot-data-plane`).
- **Frontend Layer:** Nunjucks Templating Engine with Glassmorphism UI.

## 3. Database Schema

The database relies on PostgreSQL and Sequelize ORM:

- **Admins Table:** `id`, `username`, `password_hash`
- **Devices Table:** `id`, `name`, `description`, `current_content`, `is_online`, `last_seen`
- **UpdateRequests Table:** `id`, `device_id`, `requested_by`, `new_content`, `status` (PENDING, APPROVED, REJECTED), `admin_notes`

## 4. API Design

### 4.1 Authentication (Web Dashboard)
The dashboard uses HTTP cookies for authentication:
- `POST /login`: Validates admin credentials against bcrypt hashes and sets an `auth_token` HttpOnly cookie.
- `GET /logout`: Clears the session cookie.

### 4.2 Webhook API
- `POST /api/webhooks/iot-presence`: Receives connection state changes from AWS IoT Core rules to update the `is_online` status of devices in real-time.

### 4.3 Mobile App Endpoints
- `POST /api/requests`: Submits a new request (Status: PENDING). Secured by `X-API-Key` matching `APP_API_KEY`.
- `GET /api/requests/:device_id`: Fetches requests for a specific device.

### 4.4 Admin Approvals
- `POST /api/admin/requests/:id/approve`: Approves a request, updates the Device's `current_content`, and publishes the change via AWS IoT Core to the hardware immediately.
- `POST /api/admin/requests/:id/reject`: Rejects a request.

## 5. Deployment

Refer to `cloud_setup.md` for a complete guide on deploying this Node.js app to an AWS EC2 instance, connecting to AWS RDS, and managing credentials securely with AWS Secrets Manager.
