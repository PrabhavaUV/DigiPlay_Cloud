const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

async function loadSecrets() {
    // Auto-fetch from AWS if explicitly told to, OR if there's no local DATABASE_URL provided (e.g. no .env file)
    const shouldFetchAWS = process.env.USE_AWS_SECRETS === 'true' || !process.env.DATABASE_URL;
    
    if (!shouldFetchAWS) {
        return;
    }

    console.log('[AWS] Fetching secrets from AWS Secrets Manager...');
    const secret_name = process.env.AWS_SECRET_NAME || "digiplay/prod/config";
    const region = process.env.AWS_REGION || "ap-southeast-2";

    try {
        const client = new SecretsManagerClient({ region });
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name,
            })
        );

        if (response.SecretString) {
            const secrets = JSON.parse(response.SecretString);
            for (const [key, value] of Object.entries(secrets)) {
                process.env[key] = value;
            }
            console.log('[AWS] Secrets loaded successfully into environment.');
        }
    } catch (error) {
        console.error('[AWS] Failed to fetch secrets:', error);
        // Continue anyway in case fallback variables exist, or exit?
        // Let's not fail entirely if they have local fallbacks.
        // process.exit(1); 
    }
}

module.exports = loadSecrets;
