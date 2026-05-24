const express = require('express');
const path = require('path');
const { publishToDevice } = require('./aws-iot');
const { getSecrets } = require('./aws-config');
const cookieParser = require('cookie-parser');

/**
 * STARTUP WRAPPER
 * We wrap everything in an async function so we can wait for AWS Secrets 
 * before initializing the database and routes.
 */
async function startServer() {
    // 1. Fetch Cloud Secrets
    const secrets = await getSecrets();
    if (secrets) {
        if (secrets.DATABASE_URL) process.env.DATABASE_URL = secrets.DATABASE_URL;
        if (secrets.SECRET_KEY) process.env.SECRET_KEY = secrets.SECRET_KEY;
        if (secrets.APP_API_KEY) process.env.APP_API_KEY = secrets.APP_API_KEY;
    }

    // 2. Initialize DB and Models (Now using Cloud Secrets)
    const db = require('./database');
    const { UpdateRequest, Device, Admin } = require('./models');
    const { verifyPassword, createAccessToken, requireAdmin } = require('./auth');

    /**
     * -------------------------------------------------------------------
     * EXPRESS APP CONFIGURATION
     * -------------------------------------------------------------------
     */
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use('/static', express.static(path.join(__dirname, 'static')));

    nunjucks.configure('templates', {
        autoescape: true,
        express: app,
        noCache: true
    });
    app.set('view engine', 'html');

    /**
     * -------------------------------------------------------------------
     * AWS IOT PRESENCE WEBHOOK
     * -------------------------------------------------------------------
     * Setup an AWS IoT Core Rule to POST to this endpoint when devices
     * connect or disconnect. Topic: $aws/events/presence/+/+
     */
    app.post('/api/webhooks/iot-presence', async (req, res) => {
        const { clientId, eventType } = req.body;
        // eventType will be 'connected' or 'disconnected'
        if (clientId && clientId.startsWith('DigiPlayClient-')) {
            const deviceId = clientId.replace('DigiPlayClient-', '');
            try {
                const device = await Device.findByPk(deviceId);
                if (device) {
                    device.is_online = (eventType === 'connected');
                    if (device.is_online) device.last_seen = new Date();
                    await device.save();
                    console.log(`[AWS IoT Presence] Device ${deviceId} is now ${device.is_online ? 'ONLINE' : 'OFFLINE'}`);
                }
            } catch (err) {
                console.error(`[AWS IoT Presence] Error updating device ${deviceId}:`, err);
            }
        }
        res.sendStatus(200);
    });

    /**
     * -------------------------------------------------------------------
     * SYSTEM ROUTES
     * -------------------------------------------------------------------
     */
    app.use('/api/admin', require('./routes/admin'));
    app.use('/api/devices', require('./routes/devices'));
    app.use('/api/requests', require('./routes/requests'));


    app.get('/', (req, res) => res.redirect('/dashboard'));
    app.get('/login', (req, res) => res.render('login.html'));

    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        try {
            const admin = await Admin.findOne({ where: { username } });
            if (!admin || !(await verifyPassword(password, admin.password_hash))) {
                return res.render('login.html', { error: 'Invalid username or password' });
            }
            const token = createAccessToken({ sub: admin.username });
            res.cookie('auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
            res.redirect('/dashboard');
        } catch (error) {
            res.render('login.html', { error: 'Authentication error occurred' });
        }
    });

    app.get('/logout', (req, res) => {
        res.clearCookie('auth_token');
        res.redirect('/login');
    });

    app.get('/dashboard', requireAdmin, async (req, res) => {
        const device_count = await Device.count();
        const online_count = await Device.count({ where: { is_online: true } });
        const pending_requests = await UpdateRequest.findAll({
            where: { status: 'PENDING' },
            include: [{ model: Device, as: 'device' }]
        });
        res.render('dashboard.html', { device_count, online_count, pending_requests });
    });

    app.get('/devices', requireAdmin, async (req, res) => {
        const devices = await Device.findAll();
        res.render('devices.html', {
            devices,
            new_device_id: req.query.new_id
        });
    });

    app.post('/devices/new', requireAdmin, async (req, res) => {
        const { name, description } = req.body;
        const device = await Device.create({ name, description });
        res.redirect(`/devices?new_id=${device.id}`);
    });

    app.post('/devices/push', requireAdmin, async (req, res) => {
        const { deviceId, content } = req.body;
        const device = await Device.findByPk(deviceId);
        if (device) {
            device.current_content = content;
            await device.save();

            await publishToDevice(device.id, content);
        }
        res.redirect('/devices');
    });

    app.post('/devices/delete', requireAdmin, async (req, res) => {
        const { deviceId } = req.body;
        await Device.destroy({ where: { id: deviceId } });
        res.redirect('/devices');
    });

    app.get('/requests', requireAdmin, async (req, res) => {
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

