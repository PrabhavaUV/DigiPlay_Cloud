const { getSecrets } = require('../aws-config');

async function createAdmin() {
    console.log("[Seed] Fetching database config...");
    const secrets = await getSecrets();
    if (secrets && secrets.DATABASE_URL) {
        process.env.DATABASE_URL = secrets.DATABASE_URL;
    }

    // Require models AFTER env is set
    const { Admin, sequelize } = require('../models');
    const { hashPassword } = require('../auth');

    await sequelize.sync(); // Ensure tables are created
    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'securepass123';

    try {
        const existing = await Admin.findOne({ where: { username } });
        if (existing) {
            console.log(`Admin user '${username}' already exists.`);
            process.exit(0);
        }

        const hashed = await hashPassword(password);
        await Admin.create({
            username: username,
            password_hash: hashed
        });
        console.log(`Successfully created admin user '${username}'!`);
        process.exit(0);
    } catch (err) {
        console.error('Failed to create admin:', err);
        process.exit(1);
    }
}

createAdmin();
