const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

/**
 * aws-config.js
 * Utility to fetch application secrets from AWS Secrets Manager.
 */

const region = "ap-southeast-2"; // Updated to match your Sydney infrastructure
const secretName = "digiplay/prod/config-v2";

const client = new SecretsManagerClient({ region });

async function getSecrets() {
    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secretName,
                VersionStage: "AWSCURRENT",
            })
        );

        if (response.SecretString) {
            console.log("[AWS] Secrets retrieved successfully.");
            return JSON.parse(response.SecretString);
        }
    } catch (error) {
        console.error("[AWS] Error retrieving secrets:", error.message);
        // Fallback to .env for local development if AWS fetch fails
        return {
            DATABASE_URL: process.env.DATABASE_URL,
            SECRET_KEY: process.env.SECRET_KEY,
            APP_API_KEY: process.env.APP_API_KEY
        };
    }
}

module.exports = { getSecrets };
