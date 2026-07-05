require('dotenv').config();
const loadSecrets = require('./src/load_secrets');

// Initialize secrets (if enabled) before starting the main server logic
loadSecrets().then(() => {
    require('./server.js');
});
