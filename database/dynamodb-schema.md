# DynamoDB Schema — HostelWaterLeakAlerts

## Table Name
`HostelWaterLeakAlerts`

## Primary Key
| Attribute | Type | Key Type |
|---|---|---|
| `alertId` | String (S) | Partition Key (HASH) |

No sort key is required — each alert is independently keyed by its unique ID,
and the Lambda `GET /alerts` handler scans + filters in-memory, which is
perfectly fine for a college-project scale dataset (dozens to low-thousands
of items).

## Item Attributes (written by Lambda)

| Field | Type | Example | Notes |
|---|---|---|---|
| `alertId` | String | `ALERT-3F9A1C2B` | Partition key, auto-generated |
| `location` | String | `Hostel Block A` | |
| `room` | String | `101` | |
| `eventType` | String | `WATER_LEAK` or `MANUAL_EMERGENCY` | |
| `severity` | String | `HIGH` / `MEDIUM` / `LOW` | |
| `status` | String | `ACTIVE` / `RESOLVED` | |
| `message` | String | `Water leakage detected at Hostel Block A - Room 101.` | |
| `createdAt` | String (ISO 8601) | `2026-09-15T22:20:11.123456+00:00` | |
| `resolvedAt` | String (ISO 8601) or `null` | | Set when resolved |
| `responseTime` | Number | `42.15` | milliseconds, used for `averageResponseTime` stat |
| `notificationStatus` | String | `SENT` | |

## Creating the Table via AWS Console

1. Open the **DynamoDB** console.
2. Click **Create table**.
3. Table name: `HostelWaterLeakAlerts`
4. Partition key: `alertId` — type **String**
5. Leave sort key blank.
6. Table settings: choose **Default settings** (On-demand capacity is
   recommended for a project/demo — no capacity planning needed).
7. Click **Create table** and wait for status **Active**.

That's it — no secondary indexes, no complex configuration needed.

## Sample Item (JSON view in console)

```json
{
  "alertId": "ALERT-3F9A1C2B",
  "location": "Hostel Block A",
  "room": "101",
  "eventType": "WATER_LEAK",
  "severity": "HIGH",
  "status": "ACTIVE",
  "message": "Water leakage detected at Hostel Block A - Room 101.",
  "createdAt": "2026-09-15T22:20:11.123456+00:00",
  "resolvedAt": null,
  "responseTime": 42.15,
  "notificationStatus": "SENT"
}
```
