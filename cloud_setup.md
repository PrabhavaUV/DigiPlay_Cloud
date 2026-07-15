# 🚀 DigiPlay AWS Cloud Deployment Guide

This guide provides a professional, step-by-step walkthrough for deploying the **DigiPlay** platform using a robust AWS architecture. We are moving beyond a simple local deployment to a secure, scalable infrastructure hosted entirely on AWS.

---

## 🏗️ 1. Architecture Overview

```mermaid
graph TD
    %% Styling Classes
    classDef cloud fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:white;
    classDef hardware fill:#007BFF,stroke:#0056b3,stroke-width:2px,color:white;
    classDef db fill:#336791,stroke:#264d73,stroke-width:2px,color:white;
    classDef web fill:#28a745,stroke:#1e7e34,stroke-width:2px,color:white;
    classDef iam fill:#DD344C,stroke:#8b1b2a,stroke-width:2px,color:white;

    subgraph AWS ["AWS Cloud Infrastructure"]
        EC2{"EC2 Server (Node.js + MQTT)"}:::cloud
        RDS[(RDS PostgreSQL Database)]:::db
        SM[Secrets Manager]:::iam
        IAM[IAM Role]:::iam
    end

    Admin[🖥️ Admin Browser]:::web -->|"Port 8000 (HTTP)"| EC2
    ESP32[🔌 ESP32 Devices]:::hardware -->|"MQTT"| EC2
    
    EC2 -->|Uses Role| IAM
    IAM -->|Fetches Secrets| SM
    EC2 -->|Connects via Port 5432| RDS
```

This deployment utilizes 5 core AWS technologies:
1. **Networking**: A Custom VPC with 2 public subnets deployed across 2 different Availability Zones (AZs) for high availability.
2. **Compute**: An EC2 instance (Ubuntu 22.04) running both the Node.js Express dashboard and the Aedes MQTT broker.
3. **Database**: Amazon RDS (PostgreSQL) to store all users, device states, and display data.
4. **Security**: AWS Secrets Manager to hold sensitive environment variables (DB URLs, API Keys) securely instead of relying on `.env` files.
5. **Identity**: An IAM Role attached to the EC2 instance granting it strict permissions to fetch the secrets at runtime.

---

## 🌐 2. Phase 1: Networking (VPC Setup)
A custom Virtual Private Cloud (VPC) isolates your resources and ensures secure networking.

1.  **VPC Dashboard**: Go to [AWS VPC Console](https://console.aws.amazon.com/vpc/).
2.  **Create VPC**: Click "Create VPC".
    *   Select **"VPC and more"**.
    *   **Name**: `DigiPlay-VPC`.
    *   **IPv4 CIDR**: `10.0.0.0/16`.
    *   **Number of Availability Zones**: 2.
    *   **Number of Public Subnets**: 2 (e.g., `10.0.1.0/24` and `10.0.2.0/24`).
    *   **DNS Hostnames/Support**: Enabled.
3.  **Click "Create VPC"**.

---

## 🗄️ 3. Phase 2: Database (Amazon RDS - PostgreSQL)
We will use a managed PostgreSQL instance to prevent data loss if the EC2 instance restarts.

1.  **RDS Dashboard**: Go to [AWS RDS Console](https://console.aws.amazon.com/rds/).
2.  **Create Database**:
    *   **Engine**: PostgreSQL.
    *   **Templates**: **Free Tier**.
    *   **DB Instance Identifier**: `digiplay-db`.
    *   **Credentials**: Set a master username (e.g., `postgres`) and a secure password.
    *   **Connectivity**: 
        *   Select `DigiPlay-VPC`.
        *   **Subnet Group**: Create new DB subnet group / Ensure it spans both AZs you created.
        *   **Public Access**: **No** (Connect internally via VPC for best security).
    *   **Security Group**: Create a new SG (`rds-sg`) and ensure it allows Inbound traffic on Port `5432` from your EC2's Security Group.
    *   **Additional configuration**
        *   **initial database name** : digiplay_db
3.  **Note the Endpoint** (e.g., `digiplay-db.xyz.us-east-1.rds.amazonaws.com`).

---

## 🔒 4. Phase 3: Security (Secrets Manager)
Instead of storing keys in a `.env` file on the server, we use AWS Secrets Manager. The DigiPlay code has been updated to automatically fetch these at startup!

1.  **Secrets Manager**: Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/).
2.  **Store a new secret**:
    *   **Secret Type**: "Other type of secret".
    *   **Key/Value Pairs**:
        *   `DATABASE_URL`: `postgresql://postgres:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/digiplay_db`
        *   `AWS_IOT_ENDPOINT`: *(Your unique ATS endpoint from IoT Core -> Settings)*
    *   **Secret Name**: `digiplay/prod/config`.
3.  **Save**.

---

## 📡 Phase 4: Communication (AWS IoT Core)

1.  **Console**: Go to [AWS IoT Console](https://console.aws.amazon.com/iot/).
2.  **Things**: Go to **Manage** -> **Things** -> **Create Single thing**.
3.  **Name**: `DigiPlay_Display_01`.
4.  **Certificates**: Select **Auto-generate a new certificate**.
5.  **Policy**: Create and attach a policy named `DigiPlay_Policy` allowing `iot:Connect`, `iot:Subscribe`, `iot:Receive`, and `iot:Publish`.
6.  **Download**: **CRITICAL**. Download the Device Certificate, Private Key, and Amazon Root CA 1. You will need these for the ESP32.

---

## 🔑 6. Phase 5: Identity (IAM Role for EC2)
Your EC2 instance needs permission to read the secret you just created.

1.  **IAM Dashboard**: Go to [AWS IAM Console](https://console.aws.amazon.com/iam/).
2.  **Create Policy**:
    *   **Service**: Secrets Manager.
    *   **Actions**: `GetSecretValue`.
    *   **Resources**: All / Provide the exact ARN of your secret (`digiplay/prod/config`).
    *   **Name**: `DigiPlaySecretsPolicy`.
3.  **Create Role**:
    *   **Trusted Entity**: AWS Service -> EC2.
    *   **Permissions**: Attach `DigiPlaySecretsPolicy`.
    *   **Role Name**: `DigiPlayEC2Role`.

---


## 💻 7. Phase 6: Compute (EC2 & Deployment)

### 1. Launch the Server
1.  **Launch Instance**:
    *   **Name**: `DigiPlay-Server`.
    *   **AMI**: Ubuntu 22.04 LTS.
    *   **Instance Type**: `t2.micro` or `t3.micro`.
    *   **Network**: Select `DigiPlay-VPC` and one of your **Public Subnets**.
    *   **Auto-assign Public IP**: **Enable**.
    *   **IAM Role**: Select `DigiPlayEC2Role` (under Advanced Details).
2.  **Security Group** (Important!):
    *   Allow **SSH (Port 22)** from your IP.
    *   Allow **Custom TCP (Port 8000)** from Anywhere (For the Web Dashboard).
    *   Allow **Custom TCP (Port 1883)** from Anywhere (For the ESP32 MQTT broker).

### 2. Connect & Deploy Code
Connect to your EC2 instance via SSH:
```bash
ssh -i key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Install Node.js and clone the project:
```bash
# Install Node 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Clone your code
git clone <your-repo>
cd DigiPlay_Cloud/server
npm install
```

Start the server using the AWS Secrets configuration:
```bash
npm run seed
npm start
```

---

## ⚠️ 8. Common Deployment Problems & Solutions

Based on real-world deployments, here are the most common issues you might face and exactly how to fix them:

**1. "CredentialsProviderError: Could not load credentials from any providers"**
- **Symptom**: `npm run seed` crashes instantly when trying to fetch secrets.
- **Cause**: The EC2 instance does not have permission to talk to AWS Secrets Manager.
- **Fix**: You missed Step 6! Right-click your EC2 instance in the AWS Console -> Security -> Modify IAM Role -> Attach the `DigiPlayEC2Role`.

**2. "ETIMEDOUT 10.0.x.x:5432"**
- **Symptom**: The code loads secrets but then hangs and times out connecting to PostgreSQL.
- **Cause**: The RDS Database firewall is blocking the EC2 server.
- **Fix**: Go to your RDS Security Group (`rds-sg`). Check your Inbound Rules. If the Source is set to your personal home Wi-Fi IP (e.g. `223.185.x.x/32`), delete it. Change the Source to the **Security Group ID of your EC2 instance** or the VPC CIDR (`10.0.0.0/16`).

**3. "no pg_hba.conf entry... no encryption"**
- **Symptom**: Connection is established but rejected by PostgreSQL because it is unencrypted.
- **Cause**: AWS RDS strictly requires SSL encryption by default.
- **Fix**: Ensure your `server/src/database.js` file is updated to include `dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }` in the Sequelize configuration.

**4. "Cannot find module 'dotenv'" or "Please install sqlite3 package manually"**
- **Symptom**: Running `npm run seed` throws missing module errors.
- **Cause**: You transferred the code but didn't install the Node dependencies on the EC2 server.
- **Fix**: Always run `npm install` inside the `server/` directory before trying to start the app or seed the database!
