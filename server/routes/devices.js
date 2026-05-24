const express = require('express');
const { Device } = require('../models');
require('dotenv').config();

const router = express.Router();
const APP_API_KEY = process.env.APP_API_KEY || 'my-mobile-app-static-key';

/**
 * Middleware: allowApp
 * Allows access if the static Mobile App API Key is present.
 */
function allowApp(req, res, next) {
    const key = req.headers['x-api-key'];
    if (key === APP_API_KEY) {
        return next();
    }
    return res.status(401).json({ detail: "Unauthorized" });
}

/**
 * GET /api/devices
 * Lists all registered devices.
 */
router.get('/', allowApp, async (req, res) => {
    const devices = await Device.findAll();
    res.json(devices);
});

/**
 * GET /api/devices/:id
 * Fetches details for a specific device. Used by the mobile app.
 */
router.get('/:id', allowApp, async (req, res) => {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.status(404).json({ detail: "Device not found" });
    res.json(device);
});

module.exports = router;
