const { IoTDataPlaneClient, PublishCommand } = require("@aws-sdk/client-iot-data-plane");

// The AWS region your IoT Core is deployed in.
const region = process.env.AWS_REGION || "ap-southeast-2";

// The endpoint needs to be your specific AWS IoT Core endpoint (found in AWS IoT Core Settings).
// e.g., 'xxxxxxxxxxxxxx-ats.iot.ap-southeast-2.amazonaws.com'
const endpoint = process.env.AWS_IOT_ENDPOINT || "YOUR_IOT_ENDPOINT_HERE";

// Don't initialize if we don't have a real endpoint yet
const isConfigured = endpoint !== "YOUR_IOT_ENDPOINT_HERE";

const iotClient = isConfigured ? new IoTDataPlaneClient({
    region,
    endpoint: `https://${endpoint}`
}) : null;

async function publishToDevice(deviceId, content) {
    if (!iotClient) {
        console.warn("[AWS IoT] WARNING: IoT Endpoint not configured. Skipping MQTT publish.");
        return;
    }

    const topic = `digiplay/devices/${deviceId}/content`;
    const payload = JSON.stringify({
        content,
        checksum: Date.now().toString().substring(0, 8)
    });

    try {
        const command = new PublishCommand({
            topic,
            payload: Buffer.from(payload),
            qos: 1,
            retain: true
        });
        await iotClient.send(command);
        console.log(`[AWS IoT] Successfully published to ${topic}`);
    } catch (err) {
        console.error(`[AWS IoT] Failed to publish to ${topic}:`, err);
    }
}

module.exports = { publishToDevice };
