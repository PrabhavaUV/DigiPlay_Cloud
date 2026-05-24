# 🚀 DigiPlay Cloud Deployment Guide (Enterprise AWS Edition)

This guide provides a professional walkthrough for deploying the **DigiPlay Essential 5** architecture (EC2, VPC, RDS, IoT Core, and Secrets Manager).

---

## 💰 1. Cost Analysis (AWS Free Tier)

| Component | AWS Service | Free Tier Allowance |
| :--- | :--- | :--- |
| **Compute** | EC2 `t2.micro` | 750 hours / month |
| **Database** | RDS `db.t3.micro` | 750 hours / month (PostgreSQL) |
| **Secrets** | Secrets Manager | 30 days free trial ($0.40/secret after) |
| **IoT** | AWS IoT Core | 2,250,000 minutes of connection / year |

---

## 🛠️ Phase 1: Networking (VPC Setup)

1.  **VPC Dashboard**: Go to [VPC Console](https://console.aws.amazon.com/vpc/).
2.  **Create VPC**: Click "Create VPC".
3.  **Settings**: 
    *   Select **"VPC and more"**.
    *   **Name tag**: `DigiPlay-VPC`.
    *   **Public subnets**: 1 (for EC2).
    *   **Private subnets**: 1 (for RDS).
4.  **Create**: Click **Create VPC**. This sets up your routing, internet gateway, and subnets automatically.

---

## 🔒 Phase 2: Security (Secrets Manager)

1.  **Console**: Go to [Secrets Manager](https://console.aws.amazon.com/secretsmanager/).
2.  **Store Secret**: Click "Store a new secret".
3.  **Secret Type**: Select "Other type of secret".
4.  **Key/Value Pairs**: Add the following:
    *   `DATABASE_URL`: (Temporary value, update after Phase 3)
    *   `SECRET_KEY`: (Generate via `openssl rand -hex 32`)
    *   `APP_API_KEY`: (Your secure mobile app key)
5.  **Secret Name**: `digiplay/prod/config`.
6.  **Store**: Click **Store**.

---

## 🗄️ Phase 3: Database (Amazon RDS)

1.  **Console**: Go to [RDS Console](https://console.aws.amazon.com/rds/).
2.  **Create Database**: Click "Create database".
3.  **Engine**: Select **PostgreSQL**.
4.  **Templates**: Select **Free Tier**.
5.  **Settings**: 
    *   **DB instance identifier**: `digiplay-db`.
    *   **Master username**: `postgres`.
    *   **Master password**: (Generate and store in Secrets Manager).
6.  **Connectivity**: 
    *   **VPC**: Select `DigiPlay-VPC`.
    *   **Public access**: No.
7.  **Create**: Click **Create database**.
8.  **Finalize**: Once created, copy the **Endpoint** and update the `DATABASE_URL` in your Secret (Step 2).
    *   Format: `postgres://postgres:password@endpoint:5432/postgres`

---

## 📡 Phase 4: Communication (AWS IoT Core)

1.  **Console**: Go to [AWS IoT Console](https://console.aws.amazon.com/iot/).
2.  **Things**: Go to **Manage** -> **Things** -> **Create things**.
3.  **Name**: `DigiPlay_Display_01`.
4.  **Certificates**: Select **Auto-generate a new certificate**.
5.  **Policy**: Create a policy named `DigiPlay_Policy` allowing `iot:Connect`, `iot:Subscribe`, `iot:Receive`, and `iot:Publish`.
6.  **Download**: **CRITICAL**. Download the Device Certificate, Private Key, and Amazon Root CA 1. You will need these for the ESP32.

---

## 🛡️ Phase 5: Identity & Access Management (IAM Role)

1.  **Console**: Go to [IAM Console](https://console.aws.amazon.com/iam/).
2.  **Roles**: Navigate to "Roles" and click "Create role".
3.  **Trusted Entity**: Select "AWS service" and choose "EC2" as the use case.
4.  **Permissions**: Search for and select the `SecretsManagerReadWrite` policy.
5.  **Name**: Give it a name like `DigiPlay-EC2-Secrets-Role`.
6.  **Create**: Click "Create role".

---

## 💻 Phase 6: Compute (EC2 Launch)

1.  **Console**: Go to [EC2 Console](https://console.aws.amazon.com/ec2/).
2.  **Launch**: Name: `DigiPlay-Backend`.
3.  **OS**: Ubuntu 22.04 LTS.
4.  **Network Settings**: 
    *   **VPC**: `DigiPlay-VPC`.
    *   **Security Group**: Create one allowing `8000` (Dashboard), `22` (SSH).
5.  **IAM Role**: In the "Advanced details" section, attach the `DigiPlay-EC2-Secrets-Role` created in Phase 5.
6.  **Launch**: Launch the instance.

---

## 🚀 Phase 7: Server Deployment

1.  **SSH into EC2**: `ssh -i key.pem ubuntu@EC2-IP`.
2.  **Install Node.js**: 
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    ```
3.  **Deploy Code**:
    ```bash
    git clone <your-repo>
    cd DigiPlay/server
    npm install
    # Note: No .env file needed! Code fetches from Secrets Manager.
    sudo npm install -g pm2
    pm2 start index.js --name "digiplay-backend"
    ```

---

## 🔍 Troubleshooting & Success Tips
*   **Database connection fails (Timeout)?** Check the RDS Security Group. You must allow inbound traffic on port 5432 with the **EC2's Security Group ID** as the source.
*   **Database connection fails (SSL)?** AWS RDS requires SSL. Ensure `database.js` has `dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }`.
*   **Secrets not loading?** Ensure the EC2 has an **IAM Role** attached with the `SecretsManagerReadWrite` policy. 
*   **Region Errors?** Double check that your code, EC2, and Secret are all in `ap-southeast-2` (Sydney).

---

## 💸 Cost Saving Checklist (Before you leave)
1. [ ] **Delete NAT Gateways** (VPC Console) - They cost ~$32/month.
2. [ ] **Release Elastic IPs** - They charge if not attached to a running server.
3. [ ] **Stop/Terminate EC2** - Only if you aren't using the server.
4. [ ] **Delete RDS Snapshots** - AWS charges for storage of old snapshots.
