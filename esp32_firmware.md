# DigiPlay – IoT-Based Remote Digital Name Display System
# `esp32_firmware.md` — ESP32 Device Firmware

---

## 1. Device Overview

Each DigiPlay ESP32 device is an autonomous display unit that:
- Connects to WiFi automatically via the WiFiManager captive portal
- Connects securely to **AWS IoT Core** using TLS 1.2 (Port 8883) and AWS X.509 Certificates
- Subscribes to its dedicated MQTT topic to receive real-time display updates
- Displays the current approved message on an SSD1306 OLED screen

## 2. Hardware Components

- **Microcontroller:** ESP32 WROOM-32 or WROVER
- **Display:** SSD1306 OLED 0.96" (128x64 I2C)
- **Status LED:** Connected to GPIO 2
- **Reset Button:** Connected to GPIO 0 (hold to clear WiFi credentials)

## 3. Circuit Diagram

- **SSD1306 SDA** -> GPIO 21
- **SSD1306 SCL** -> GPIO 22
- **Status LED** -> GPIO 2

## 4. Server Communication Logic (AWS IoT Core)

The firmware has been explicitly designed for AWS IoT Core integration. It uses `WiFiClientSecure` to establish an encrypted TLS connection.
It requires three certificates to be flashed directly onto the device:
1. Amazon Root CA 1
2. Device Certificate
3. Device Private Key

It connects to the broker at your specific AWS IoT Endpoint (e.g., `xxxxxxxx-ats.iot.ap-southeast-2.amazonaws.com`) on port `8883`.

### 4.1 MQTT Topic Structure
The device subscribes to the following topic using the `PubSubClient` library:
`digiplay/devices/{DEVICE_ID}/content`

When the admin approves a request on the web dashboard, the Node.js server uses the AWS SDK to publish the new content to this exact topic. The ESP32 receives the payload instantly, parses the JSON using `ArduinoJson`, and updates the OLED display.

## 5. Complete Firmware Code

Please refer to the `digiplay_firmware/digiplay_firmware.ino` file for the complete, up-to-date source code.
