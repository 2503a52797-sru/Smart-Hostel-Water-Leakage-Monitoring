# AWS Console Deployment Guide
## Smart Hostel Water Leakage Alert & Monitoring Simulator

This guide is 100% AWS Console-based — no CLI required. Two hosting options
for the dashboard are covered:

- **Part A** — Backend (DynamoDB + IAM + Lambda + API Gateway) — **required, do this first**
- **Part B** — Frontend on **EC2** (what you asked for)
- **Part C** — Frontend on **S3** (alternative, optional — skip if using EC2)

---

# PART A — BACKEND SETUP

## STEP 1 — Create the DynamoDB Table

1. AWS Console → search **DynamoDB** → **Create table**.
2. Table name: `HostelWaterLeakAlerts`
3. Partition key: `alertId`, type **String**
4. Leave everything else default (On-demand capacity).
5. Click **Create table**. Wait until status = **Active**.

(Full field reference: `/database/dynamodb-schema.md`)

## STEP 2 — Create the IAM Role for Lambda

1. AWS Console → **IAM** → **Roles** → **Create role**.
2. Trusted entity type: **AWS service** → Use case: **Lambda**.
3. Attach policies:
   - `AWSLambdaBasicExecutionRole`
   - `AmazonDynamoDBFullAccess` (simplest for a project; for tighter security
     you can instead create a custom policy scoped to just
     `HostelWaterLeakAlerts` table actions: `GetItem`, `PutItem`, `UpdateItem`, `Scan`)
4. Role name: `HostelWaterLeakLambdaRole`
5. Click **Create role**.

## STEP 3 — Create the Lambda Function

1. AWS Console → **Lambda** → **Create function**.
2. Choose **Author from scratch**.
3. Function name: `HostelWaterLeakHandler`
4. Runtime: **Python 3.12**
5. Architecture: `x86_64` (default is fine).
6. Under **Permissions** → **Change default execution role** → **Use an existing role**
   → select `HostelWaterLeakLambdaRole`.
7. Click **Create function**.

## STEP 4 — Deploy the Lambda Code

1. In the Lambda function page, scroll to the **Code** tab.
2. Delete the placeholder code in `lambda_function.py`.
3. Open `backend/lambda_function.py` from this project, copy its **entire**
   contents, and paste it into the Lambda code editor.
4. Click **Deploy** (top of the code editor).
5. Go to **Configuration** tab → **Environment variables** → **Edit** → **Add
   environment variable**:
   - Key: `TABLE_NAME`
   - Value: `HostelWaterLeakAlerts`
6. Save.
7. (Optional but recommended) Configuration → General configuration → Edit →
   set **Timeout** to `10 sec` (default 3 sec is usually enough, but this
   gives headroom).

## STEP 5 — Create the API Gateway

1. AWS Console → **API Gateway** → **Create API**.
2. Choose **HTTP API** → **Build**.
3. Integrations: click **Add integration** → **Lambda** → select
   `HostelWaterLeakHandler`.
4. API name: `HostelWaterLeakAPI`
5. Click **Next** through the wizard for now (we'll define routes properly in
   Step 6) — or configure the first route here and add the rest after.
6. Click **Create**.

## STEP 6 — Create Routes

In the API you just created, go to **Routes** → **Create** and add each of
these six routes, all integrated with `HostelWaterLeakHandler`:

| Method | Route |
|---|---|
| POST | `/alerts` |
| GET | `/alerts` |
| GET | `/alerts/{alertId}` |
| GET | `/stats` |
| PATCH | `/alerts/{alertId}/resolve` |
| POST | `/alerts/emergency` |

For each route: **Create** → enter method + path → **Attach integration** →
choose the existing `HostelWaterLeakHandler` Lambda integration.

## STEP 7 — Connect Routes to Lambda

If you created routes without attaching an integration in Step 6, go to each
route → **Attach integration** → select the `HostelWaterLeakHandler` Lambda
integration created in Step 5.

## STEP 8 — Configure CORS

1. In the left sidebar of your API, click **CORS**.
2. Click **Configure**.
3. Set:
   - **Access-Control-Allow-Origin**: `*` (for a college project this is
     fine; in production you'd restrict it to your exact frontend URL)
   - **Access-Control-Allow-Headers**: `Content-Type, Authorization`
   - **Access-Control-Allow-Methods**: `GET, POST, PATCH, OPTIONS`
4. Save.

> Note: the Lambda code also returns CORS headers on every response as a
> safety net, so the dashboard will work even if a preflight is cached
> slightly differently.

## STEP 9 — Deploy the API

HTTP APIs auto-deploy to the `$default` stage, so this typically happens
automatically. Confirm by going to **Stages** in the left sidebar — you
should see a `$default` stage listed as deployed.

## STEP 10 — Copy the API Gateway URL

1. Go to **API Gateway** → your API → **Stages** → `$default`.
2. Copy the **Invoke URL**, e.g.:
   `https://abc123xyz.execute-api.ap-south-1.amazonaws.com`
3. Keep this — you'll paste it into the frontend next.

## STEP 11 — Put the API URL into the Frontend

1. Open `frontend/script.js`.
2. Find:
   ```js
   const API_BASE_URL = "YOUR_API_GATEWAY_URL";
   ```
3. Replace `YOUR_API_GATEWAY_URL` with the Invoke URL from Step 10 (no
   trailing slash).
4. Save the file.

**Quick backend test before touching hosting**: you can test the API right
now from your own computer by opening `frontend/index.html` directly in a
browser (double-click it) — since it just makes `fetch()` calls to your
public API Gateway URL, it will work even before you host it anywhere.

---

# PART B — HOST THE DASHBOARD ON EC2 (what you asked for)

This runs the static frontend files on an EC2 instance using **Nginx**.

## STEP 12 — Launch an EC2 Instance

1. AWS Console → **EC2** → **Launch instance**.
2. Name: `HostelWaterLeakDashboard`
3. AMI: **Amazon Linux 2023** (free-tier eligible).
4. Instance type: `t2.micro` or `t3.micro` (free-tier eligible).
5. Key pair: create a new key pair (e.g. `hostel-dashboard-key`) and download
   the `.pem` file if you plan to SSH in. (You can also use **EC2 Instance
   Connect**, browser-based, which needs no key pair.)
6. Network settings → **Edit**:
   - Ensure **Auto-assign public IP** = Enabled.
   - Under **Firewall (security groups)**, add these inbound rules:
     - SSH (22) — Source: My IP (for management)
     - HTTP (80) — Source: Anywhere (0.0.0.0/0) — so the dashboard is
       reachable from your browser
7. Click **Launch instance**.
8. Wait until **Instance state = Running** and note the **Public IPv4
   address**.

## STEP 13 — Connect to the Instance

Easiest method — no SSH client needed:
1. Select your instance → **Connect** → **EC2 Instance Connect** tab →
   **Connect**.
2. This opens a browser-based terminal.

## STEP 14 — Install Nginx and Upload the Frontend Files

In the EC2 Instance Connect terminal, run:

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Now you need to get the three frontend files
(`index.html`, `style.css`, `script.js` — already edited with your API URL)
onto the instance. The simplest way for a beginner:

**Option 1 — Paste directly using a text editor on the instance:**

```bash
sudo mkdir -p /usr/share/nginx/html
sudo nano /usr/share/nginx/html/index.html
```
Paste the contents of your local `index.html`, save with `Ctrl+O`, `Enter`,
exit with `Ctrl+X`. Repeat the same for:

```bash
sudo nano /usr/share/nginx/html/style.css
sudo nano /usr/share/nginx/html/script.js
```
(Paste `style.css` and the **edited** `script.js` — the one where you already
replaced `YOUR_API_GATEWAY_URL`.)

**Option 2 — Upload via SCP from your own computer** (if you downloaded the
`.pem` key pair in Step 12):

```bash
scp -i hostel-dashboard-key.pem frontend/index.html frontend/style.css frontend/script.js ec2-user@<YOUR_EC2_PUBLIC_IP>:/tmp/
```
Then on the instance:
```bash
sudo mv /tmp/index.html /tmp/style.css /tmp/script.js /usr/share/nginx/html/
```

## STEP 15 — Fix Permissions and Restart Nginx

```bash
sudo chown -R nginx:nginx /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html
sudo systemctl restart nginx
```

## STEP 16 — Open the Dashboard

In your browser, go to:

```
http://<YOUR_EC2_PUBLIC_IP>
```

You should see the **SMART HOSTEL WATER LEAKAGE MONITORING** dashboard. It
will call your API Gateway URL directly — DynamoDB traffic flows through
API Gateway → Lambda, not through the EC2 instance (EC2 here is only serving
the three static files).

> Tip: EC2 public IPs change if you stop/start the instance (unless you
> attach an Elastic IP). For a stable demo URL, allocate an **Elastic IP**
> (EC2 → Elastic IPs → Allocate → Associate with your instance) — this is
> also free-tier eligible while attached to a running instance.

---

# PART C — ALTERNATIVE: HOST ON S3 (optional, skip if using EC2)

If you ever want the simpler serverless-hosting alternative instead of EC2:

1. **S3** → **Create bucket** → uncheck "Block all public access" (accept
   the warning) → Create.
2. Upload `index.html`, `style.css`, `script.js` (with the API URL already
   filled in) to the bucket.
3. Bucket → **Properties** → **Static website hosting** → Enable → Index
   document: `index.html` → Save.
4. Bucket → **Permissions** → **Bucket policy** → add a public-read policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```
5. Open the **Bucket website endpoint** URL shown under Static website
   hosting — that's your live dashboard.

---

# Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Dashboard shows "NOT CONFIGURED" | `API_BASE_URL` still says `YOUR_API_GATEWAY_URL` | Edit `script.js`, redeploy/re-upload |
| "Unable to connect to cloud backend" | CORS not configured, or wrong API URL | Recheck Step 8 (CORS) and Step 10 (URL) |
| 403 on EC2 dashboard | Security group missing HTTP(80) inbound rule | Edit security group inbound rules |
| Lambda errors in browser console | Missing `TABLE_NAME` env var, or IAM role lacks DynamoDB permission | Recheck Step 4 and Step 2 |
| Alerts don't persist after refresh | Frontend calling a different/old API URL, or a stray leftover mock-data script | Confirm `script.js` has no hardcoded demo alerts, confirm API URL is correct |
| 404 on a specific route | Route not created or not attached to Lambda integration in API Gateway | Recheck Steps 6–7 |

# Testing Checklist

1. ☐ Dashboard loads without console errors.
2. ☐ `GET /stats` succeeds (cards populate with real numbers, not stuck at 0 indefinitely).
3. ☐ Clicking **SIMULATE WATER LEAK** creates a DynamoDB record (check DynamoDB console → Explore table items).
4. ☐ `GET /alerts` returns the new record.
5. ☐ Dashboard table shows the new alert.
6. ☐ **EMERGENCY TRIGGER** creates a `MANUAL_EMERGENCY` record.
7. ☐ **RESOLVE LEAK** changes an `ACTIVE` record to `RESOLVED` in DynamoDB.
8. ☐ Stats update after resolve.
9. ☐ Refreshing the browser retains all data (pulled fresh from DynamoDB, not cached client-side).
10. ☐ Opening the dashboard URL from a different browser/device shows the same alerts.
11. ☐ Turning off the EC2 instance (or breaking the API URL) shows a friendly error, not a raw stack trace.
12. ☐ Filters (location/status/severity/event type) correctly narrow the table.
