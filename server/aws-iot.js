require('dotenv').config();
const { IoTDataPlaneClient, PublishCommand } = require("@aws-sdk/client-iot-data-plane");

let iotClient = null;

function getIotClient() {
    if (iotClient) return iotClient;
    
    const endpoint = process.env.AWS_IOT_ENDPOINT;
    const region = process.env.AWS_REGION || "ap-southeast-2";
    
    if (endpoint && endpoint !== "YOUR_IOT_ENDPOINT_HERE") {
        iotClient = new IoTDataPlaneClient({
            region,
            endpoint: `https://${endpoint}`
        });
    }
    return iotClient;
}

async function publishToDevice(deviceId, content) {
    const client = getIotClient();
    if (!client) {
        console.warn("[AWS IoT] WARNING: IoT Endpoint not configured. Skipping MQTT publish.");
        return;
    }

    const topic = `digiplay/devices/${deviceId}/content`;
    const payload = JSON.stringify({
        content,
        checksum: Date.now().toString().substring(5)
    });

    try {
        const command = new PublishCommand({
            topic,
            payload: new TextEncoder().encode(payload),
            qos: 0
        });
        await client.send(command);
        console.log(`[AWS IoT] Successfully published to ${topic}`);
    } catch (err) {
        console.error(`[AWS IoT] Failed to publish to ${topic}:`, err);
    }
}

module.exports = { publishToDevice };
