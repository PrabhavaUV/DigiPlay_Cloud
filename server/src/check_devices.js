require('dotenv').config();
const loadSecrets = require('./load_secrets');

loadSecrets().then(async () => {
    const { Device } = require('./models');
    const sequelize = require('./database');

    async function checkDevices() {
        try {
            await sequelize.authenticate();
            const devices = await Device.findAll();
            console.log('Devices in DB:');
            devices.forEach(d => {
                console.log(`- ID: ${d.id}, Name: ${d.name}, Online: ${d.is_online}`);
            });
            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }

    checkDevices();
});
