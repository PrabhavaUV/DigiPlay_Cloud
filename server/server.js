const express = require('express');
const nunjucks = require('nunjucks');
const aedes = require('aedes')();
const net = require('net');
const path = require('path');
const db = require('./src/database');
const { Device } = require('./src/models');
const { generateDeviceToken } = require('./src/auth');
const session = require('express-session');


/**
 * -------------------------------------------------------------------
 * MQTT BROKER CONFIGURATION
 * -------------------------------------------------------------------
 * We use Aedes as our embedded MQTT broker to handle real-time 
 * communication with the ESP32 hardware displays.
 */
const mqttServer = net.createServer(aedes.handle);
const mqttPort = 1883;


// Secure the MQTT Broker using the DEVICE_ID as username and DEVICE_TOKEN as password
aedes.authenticate = async (client, username, password, callback) => {
    if (!username || !password) {
        return callback(new Error('Authentication required (Missing ID or Token)'), false);
    }

    try {
        const { verifyDeviceToken } = require('./src/auth');
        const device = await Device.findByPk(username);

        if (device && verifyDeviceToken(password.toString(), device.device_token)) {
            client.deviceId = username; // Attach device ID to client for presence tracking
            return callback(null, true);
        }

        return callback(new Error('Invalid Device ID or Token'), false);
    } catch (err) {
        console.error('[MQTT Auth] Error:', err);
        return callback(err, false);
    }
};

mqttServer.listen(mqttPort, '0.0.0.0', () => {
    console.log(`[MQTT] Broker is running on port ${mqttPort} (Authentication Enabled)`);
});

/**
 * -------------------------------------------------------------------
 * EXPRESS APP CONFIGURATION
 * -------------------------------------------------------------------
 */
const app = express();
app.use(session({
    secret: process.env.SECRET_KEY || 'some_random_secret_string',
    resave: false,
    saveUninitialized: false
}));
app.set('mqtt', aedes); // Make aedes accessible in routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

// Configure Templating Engine (Nunjucks)
nunjucks.configure('templates', {
    autoescape: true,
    express: app,
    noCache: true
});
app.set('view engine', 'html');

/**
 * -------------------------------------------------------------------
 * MQTT EVENT HANDLERS (Presence Logic)
 * -------------------------------------------------------------------
 */
aedes.on('clientReady', async (client) => {
    if (client.deviceId) {
        console.log(`[MQTT] Presence: Device ${client.deviceId} connected`);
        try {
            const device = await Device.findByPk(client.deviceId);
            if (device) {
                device.is_online = true;
                device.last_seen = new Date();
                await device.save();
            }
        } catch (err) {
            console.error(`[Presence] Error updating device ${client.deviceId}:`, err);
        }
    }
});

aedes.on('clientDisconnect', async (client) => {
    if (client.deviceId) {
        try {
            const device = await Device.findByPk(client.deviceId);
            if (device) {
                device.is_online = false;
                await device.save();
                console.log(`[Presence] Device ${client.deviceId} is now OFFLINE`);
            }
        } catch (err) {
            console.error(`[Presence] Error updating disconnect status for ${client.deviceId}:`, err);
        }
    }
});

/**
 * -------------------------------------------------------------------
 * SYSTEM ROUTES & ENDPOINTS
 * -------------------------------------------------------------------
 */


// UI Routes (Web Dashboard)
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login.html'));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const { Admin } = require('./src/models');
    const { verifyPassword } = require('./src/auth');
    const admin = await Admin.findOne({ where: { username } });

    // Check if admin exists and password matches
    if (admin && await verifyPassword(password, admin.password_hash)) {
        req.session.isAuthenticated = true; // Set the session cookie!
        res.redirect('/dashboard');
    } else {
        res.send('Invalid Credentials. <a href="/login">Try again</a>');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Middleware to protect routes
function requireDashboardAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login');
}


app.get('/dashboard', requireDashboardAuth, async (req, res) => {
    const [device_count, online_count] = await Promise.all([
        Device.count(),
        Device.count({ where: { is_online: true } })
    ]);
    res.render('dashboard.html', { device_count, online_count });
});

app.get('/devices', requireDashboardAuth, async (req, res) => {
    const devices = await Device.findAll();
    res.render('devices.html', {
        devices,
        new_device_id: req.query.new_id,
        raw_token: req.query.token
    });
});

app.post('/devices/new', requireDashboardAuth, async (req, res) => {
    const { name, description } = req.body;
    const { raw, hashed } = generateDeviceToken();
    const device = await Device.create({ name, description, device_token: hashed });
    res.redirect(`/devices?new_id=${device.id}&token=${raw}`);
});

app.post('/devices/push', requireDashboardAuth, async (req, res) => {
    const { deviceId, content } = req.body;
    const device = await Device.findByPk(deviceId);
    if (device) {
        device.current_content = content;
        await device.save();

        // Broadcast new content via MQTT immediately
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

app.post('/devices/delete', requireDashboardAuth, async (req, res) => {
    const { deviceId } = req.body;
    await Device.destroy({ where: { id: deviceId } });
    res.redirect('/devices');
});



/**
 * -------------------------------------------------------------------
 * DATABASE INITIALIZATION & SERVER START
 * -------------------------------------------------------------------
 */
db.sync({ alter: false }).then(async () => {
    // Maintenance: Reset all devices to offline on startup
    await Device.update({ is_online: false }, { where: {} });
    console.log('[DB] Database synchronized. System ready.');

    app.listen(8000, () => {
        console.log('--------------------------------------------------');
        console.log('🚀 DigiPlay Platform: http://localhost:8000');
        console.log('📁 Admin Credentials: Run npm run seed');
        console.log('--------------------------------------------------');
    });
}).catch(err => {
    console.error('[DB] Synchronization failed:', err.message);
});

