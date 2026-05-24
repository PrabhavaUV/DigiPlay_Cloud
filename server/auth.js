const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7";

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

function createAccessToken(data) {
    return jwt.sign(data, SECRET_KEY, { expiresIn: '24h' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (e) {
        return null;
    }
}

async function requireAdmin(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.redirect('/login');
    }
    const payload = verifyToken(token);
    if (!payload || !payload.sub) {
        return res.redirect('/login');
    }
    
    // Check if admin still exists
    const { Admin } = require('./models');
    const admin = await Admin.findOne({ where: { username: payload.sub } });
    if (!admin) {
        return res.redirect('/login');
    }
    
    req.admin = admin;
    next();
}

module.exports = {
    hashPassword,
    verifyPassword,
    createAccessToken,
    verifyToken,
    requireAdmin
};
