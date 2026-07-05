
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7";

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}


function generateDeviceToken() {
    const raw = crypto.randomBytes(24).toString('base64url');
    const hashed = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hashed };
}

function verifyDeviceToken(raw, storedHash) {
    const computed = crypto.createHash('sha256').update(raw).digest('hex');
    return computed === storedHash;
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateDeviceToken,
    verifyDeviceToken
};
