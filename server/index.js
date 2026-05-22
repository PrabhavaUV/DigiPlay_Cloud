const express = require('express');
const nunjucks = require('nunjucks');
const aedes = require('aedes')();
const net = require('net');
const path = require('path');
const { getSecrets } = require('./aws-config');

/**
 * STARTUP WRAPPER
 * We wrap everything in an async function so we can wait for AWS Secrets 
 * before initializing the database and routes.
 */
async function startServer() {
    // 1. Fetch Cloud Secrets
    const secrets = await getSecrets();
    if (secrets) {
        process.env.DATABASE_URL = secrets.DATABASE_URL || process.env.DATABASE_URL;
        process.env.SECRET_KEY = secrets.SECRET_KEY || process.env.SECRET_KEY;
        process.env.APP_API_KEY = secrets.APP_API_KEY || process.env.APP_API_KEY;
    }

    // 2. Initialize DB and Models (Now using Cloud Secrets)
    const db = require('./database');
    const { UpdateRequest, Device, Admin } = require('./models');
    const { generateDeviceToken, verifyPassword, createAccessToken } = require('./auth');

    /**
     * -------------------------------------------------------------------
     * MQTT BROKER CONFIGURATION
     * -------------------------------------------------------------------
     */
    const mqttServer = net.createServer(aedes.handle);
    const mqttPort = 1883;

    mqttServer.listen(mqttPort, '0.0.0.0', () => {
        console.log(`[MQTT] Broker is running on port ${mqttPort}`);
    });

    /**
     * -------------------------------------------------------------------
     * EXPRESS APP CONFIGURATION
     * -------------------------------------------------------------------
     */
    const app = express();
    app.set('mqtt', aedes);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/static', express.static(path.join(__dirname, 'static')));

    nunjucks.configure('templates', {
        autoescape: true,
        express: app,
        noCache: true
    });
    app.set('view engine', 'html');

    /**
     * -------------------------------------------------------------------
     * MQTT EVENT HANDLERS
     * -------------------------------------------------------------------
     */
    aedes.on('clientReady', async (client) => {
        console.log(`[MQTT] Presence: Client ${client.id} connected`);
        if (client.id.startsWith('DigiPlayClient-')) {
            const deviceId = client.id.replace('DigiPlayClient-', '');
            try {
                const device = await Device.findByPk(deviceId);
                if (device) {
                    device.is_online = true;
                    device.last_seen = new Date();
                    await device.save();
                    console.log(`[Presence] Device ${deviceId} is now ONLINE`);
                }
            } catch (err) {
                console.error(`[Presence] Error updating device ${deviceId}:`, err);
            }
        }
    });

    aedes.on('clientDisconnect', async (client) => {
        if (client.id && client.id.startsWith('DigiPlayClient-')) {
            const deviceId = client.id.replace('DigiPlayClient-', '');
            try {
                const device = await Device.findByPk(deviceId);
                if (device) {
                    device.is_online = false;
                    await device.save();
                    console.log(`[Presence] Device ${deviceId} is now OFFLINE`);
                }
            } catch (err) {
                console.error(`[Presence] Error updating disconnect status for ${deviceId}:`, err);
            }
        }
    });

    /**
     * -------------------------------------------------------------------
     * SYSTEM ROUTES
     * -------------------------------------------------------------------
     */
    app.use('/api/admin', require('./routes/admin'));
    app.use('/api/devices', require('./routes/devices'));
    app.use('/api/requests', require('./routes/requests'));
    app.use('/api/esp32', require('./routes/esp32'));

    app.get('/', (req, res) => res.redirect('/login'));
    app.get('/login', (req, res) => res.render('login.html'));

    app.post('/auth/login', async (req, res) => {
        const { username, password } = req.body;
        try {
            const admin = await Admin.findOne({ where: { username } });
            if (!admin || !(await verifyPassword(password, admin.password_hash))) {
                return res.status(401).json({ detail: "Invalid credentials" });
            }
            const token = createAccessToken({ sub: admin.username });
            res.json({ access_token: token });
        } catch (error) {
            res.status(500).json({ detail: "Authentication error" });
        }
    });

    app.get('/dashboard', async (req, res) => {
        const device_count = await Device.count();
        const online_count = await Device.count({ where: { is_online: true } });
        const pending_requests = await UpdateRequest.findAll({
            where: { status: 'PENDING' },
            include: [{ model: Device, as: 'device' }]
        });
        res.render('dashboard.html', { device_count, online_count, pending_requests });
    });

    app.get('/devices', async (req, res) => {
        const devices = await Device.findAll();
        res.render('devices.html', {
            devices,
            new_device_id: req.query.new_id,
            raw_token: req.query.token
        });
    });

    app.post('/devices/new', async (req, res) => {
        const { name, description } = req.body;
        const { raw, hashed } = generateDeviceToken();
        const device = await Device.create({ name, description, device_token: hashed });
        res.redirect(`/devices?new_id=${device.id}&token=${raw}`);
    });

    app.post('/devices/push', async (req, res) => {
        const { deviceId, content } = req.body;
        const device = await Device.findByPk(deviceId);
        if (device) {
            device.current_content = content;
            await device.save();

            const payload = JSON.stringify({
                content,
                checksum: Date.now().toString().substring(0, 8)
            });
            aedes.publish({
                topic: `digiplay/devices/${device.id}/content`,
                payload,
                qos: 1,
                retain: true
            });
        }
        res.redirect('/devices');
    });

    app.post('/devices/delete', async (req, res) => {
        const { deviceId } = req.body;
        await Device.destroy({ where: { id: deviceId } });
        res.redirect('/devices');
    });

    app.get('/requests', async (req, res) => {
        const requests = await UpdateRequest.findAll({
            include: [{ model: Device, as: 'device' }],
            order: [['created_at', 'DESC']]
        });
        res.render('requests.html', { requests });
    });

    /**
     * -------------------------------------------------------------------
     * DATABASE SYNC & START
     * -------------------------------------------------------------------
     */
    db.sync({ alter: false }).then(async () => {
        await Device.update({ is_online: false }, { where: {} });
        console.log('[DB] Database synchronized. System ready.');

        app.listen(8000, () => {
            console.log('--------------------------------------------------');
            console.log('🚀 DigiPlay Cloud-Native Platform: http://localhost:8000');
            console.log('🔒 Secrets loaded from AWS Secrets Manager');
            console.log('--------------------------------------------------');
        });
    }).catch(err => {
        console.error('[DB] Synchronization failed:', err.message);
    });
}

// Kick off the server
startServer();

