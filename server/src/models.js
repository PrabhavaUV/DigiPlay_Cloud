const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(100), unique: true, allowNull: false },
    password_hash: { type: DataTypes.TEXT, allowNull: false }
}, {
    tableName: 'admins',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

const Device = sequelize.define('Device', {
    id: { type: DataTypes.STRING(10), primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT },
    device_token: { type: DataTypes.STRING(256), unique: true, allowNull: false },
    current_content: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Hello!' },
    is_online: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_seen: { type: DataTypes.DATE }
}, {
    tableName: 'devices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

Device.beforeCreate(async (device) => {
    if (!device.id) {
        const lastDevice = await Device.findOne({
            order: [['created_at', 'DESC']]
        });
        if (lastDevice && lastDevice.id && lastDevice.id.startsWith('DP')) {
            const num = parseInt(lastDevice.id.replace('DP', ''), 10);
            if (!isNaN(num)) {
                device.id = 'DP' + String(num + 1).padStart(3, '0');
                return;
            }
        }
        device.id = 'DP001';
    }
});

module.exports = { Admin, Device, sequelize };
