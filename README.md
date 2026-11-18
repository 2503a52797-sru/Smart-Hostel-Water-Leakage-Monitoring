# 💧 Smart Hostel Water Leakage Alert & Monitoring Simulator

A **100% software-based AWS cloud project** — no ESP32, no Arduino, no
physical sensors. A web dashboard simulates leak events and drives a real
serverless backend (API Gateway → Lambda → DynamoDB).

## Problem Statement

Water leakage in hostels can remain undetected, causing water wastage,
property damage, and higher maintenance costs. This project demonstrates —
entirely in software — how such leakage events can be detected (simulated),
processed, stored, and communicated through a centralized monitoring
dashboard, without requiring physical IoT hardware.

## Objectives

- Demonstrate a serverless event-driven architecture on AWS.
- Simulate leak/emergency detection via a web UI instead of hardware sensors.
- Persist and retrieve real event data from a NoSQL database (DynamoDB).
- Provide a live, filterable monitoring dashboard with real-time-ish metrics.

## Features

- Live system/cloud status header
- Summary cards (Total / Active / Resolved / Emergency / Notifications)
- Animated leak indicator (flashes red on active leak)
- Hostel block + room selector
- **Simulate Water Leak**, **Emergency Trigger**, **Resolve Leak** actions
- Alert history table with filters (location, status, severity, event type)
- Live metrics sourced entirely from real API responses (no hardcoded demo data)
- Friendly error handling for network/API/Lambda failures

## Architecture

```
 WEB DASHBOARD (EC2 / S3 — static HTML/CSS/JS)
        │  fetch()
        ▼
 AMAZON API GATEWAY (HTTP API)
        │  invokes
        ▼
 AWS LAMBDA (Python — single function, routes by method+path)
        │  boto3
        ▼
 AMAZON DYNAMODB (HostelWaterLeakAlerts table)
        │
        ▲  data read back through API Gateway
 WEB DASHBOARD
```

## AWS Services Used

| Service | Purpose |
|---|---|
| Amazon EC2 (or S3) | Hosts the static dashboard |
| Amazon API Gateway | REST-style HTTP API, entry point for the frontend |
| AWS Lambda | Business logic — validates, generates IDs, reads/writes DynamoDB |
| Amazon DynamoDB | Stores alert records |
| Amazon CloudWatch *(optional)* | Lambda logs, useful for debugging/viva Q&A |

## Folder Structure

```
smart-hostel-water-leakage/
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── README.md
│
├── backend/
│   ├── lambda_function.py
│   └── README.md
│
├── database/
│   └── dynamodb-schema.md
│
├── deployment/
│   └── AWS-DEPLOYMENT.md
│
└── README.md
```

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/alerts` | Create a simulated water-leak alert |
| GET | `/alerts` | List alerts (filter by `location`, `status`, `severity`) |
| GET | `/alerts/{alertId}` | Get a single alert |
| GET | `/stats` | Aggregate statistics for the dashboard |
| PATCH | `/alerts/{alertId}/resolve` | Mark an alert resolved |
| POST | `/alerts/emergency` | Create a manual emergency alert |

## Setup Instructions

1. Deploy the backend (DynamoDB → IAM → Lambda → API Gateway) — full steps
   in `deployment/AWS-DEPLOYMENT.md`, Part A.
2. Copy the API Gateway Invoke URL into `frontend/script.js`
   (`API_BASE_URL`).
3. Host the three frontend files on **EC2** (Part B of the deployment guide)
   — or S3 (Part C) if you prefer.
4. Open the dashboard URL in your browser.

## Testing Instructions

See the full checklist at the bottom of `deployment/AWS-DEPLOYMENT.md`.
Short version: simulate a leak → confirm it appears in DynamoDB and on the
dashboard → resolve it → confirm status flips to `RESOLVED` and persists
across a page refresh.

## Expected Output

- Clicking **SIMULATE WATER LEAK** creates a real DynamoDB item, the
  indicator starts flashing red, and the alert appears in the history table
  within a second or two.
- Clicking **EMERGENCY TRIGGER** creates a `MANUAL_EMERGENCY` record with a
  descriptive message referencing the selected block/room.
- Clicking **RESOLVE LEAK** flips the most recent active alert to
  `RESOLVED`, stops the flashing indicator, and updates all counters.
- Refreshing the browser or opening the dashboard from a different device
  shows the same data, because everything is read live from DynamoDB.

## Future Scope

- Add Amazon SNS/SES to send real email/SMS notifications on leak detection.
- Add Amazon Cognito for authenticated hostel-warden logins.
- Add CloudWatch Alarms + dashboards for operational monitoring.
- Migrate from a single-Lambda router to per-route Lambda functions for
  larger-scale deployments.
- Replace scan-based `GET /alerts` filtering with DynamoDB GSIs for
  efficiency at larger scale.

## Suitability

This project is self-contained, uses only real AWS managed services, stores
and retrieves real (non-mocked) data, and is designed to be demoed live and
explained clearly in a college viva.
