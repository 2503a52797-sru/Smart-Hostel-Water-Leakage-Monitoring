"""
Smart Hostel Water Leakage Alert & Monitoring Simulator
Backend Lambda Function

Handles all API routes:
  POST   /alerts
  GET    /alerts
  GET    /alerts/{alertId}
  GET    /stats
  PATCH  /alerts/{alertId}/resolve
  POST   /alerts/emergency

Runtime: Python 3.12 (or any Python 3.x)
Requires: boto3 (already included in AWS Lambda Python runtime)

Environment Variable required:
  TABLE_NAME  -> Name of the DynamoDB table (e.g. HostelWaterLeakAlerts)
"""

import json
import os
import uuid
import time
import decimal
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "HostelWaterLeakAlerts")
table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PATCH"
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class DecimalEncoder(json.JSONEncoder):
    """DynamoDB returns Decimal objects - convert them for JSON output."""
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        return super().default(o)


def response(status_code, body_dict):
    return {
        "statusCode": status_code,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps(body_dict, cls=DecimalEncoder)
    }


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def generate_alert_id():
    return "ALERT-" + uuid.uuid4().hex[:8].upper()


def parse_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def create_alert_record(data, event_type_override=None):
    """Validates input and writes a new alert item to DynamoDB."""
    location = data.get("location")
    room = data.get("room")
    event_type = event_type_override or data.get("eventType", "WATER_LEAK")
    severity = data.get("severity", "HIGH")

    if not location or not room:
        return None, "location and room are required fields"

    start_time = time.time()
    alert_id = generate_alert_id()
    created_at = now_iso()

    item = {
        "alertId": alert_id,
        "location": location,
        "room": str(room),
        "eventType": event_type,
        "severity": severity,
        "status": "ACTIVE",
        "message": build_message(event_type, location, room),
        "createdAt": created_at,
        "resolvedAt": None,
        "responseTime": decimal.Decimal(str(round((time.time() - start_time) * 1000, 2))),
        "notificationStatus": "SENT"
    }

    table.put_item(Item=item)
    return item, None


def build_message(event_type, location, room):
    if event_type == "MANUAL_EMERGENCY":
        return f"Manual emergency water leakage alert triggered at {location} - Room {room}."
    return f"Water leakage detected at {location} - Room {room}."


# ---------------------------------------------------------------------------
# Route Handlers
# ---------------------------------------------------------------------------

def handle_post_alerts(event):
    data = parse_body(event)
    item, error = create_alert_record(data)
    if error:
        return response(400, {"success": False, "message": error})
    return response(201, {
        "success": True,
        "alertId": item["alertId"],
        "status": item["status"],
        "message": "Water leakage detected",
        "alert": item
    })


def handle_post_emergency(event):
    data = parse_body(event)
    item, error = create_alert_record(data, event_type_override="MANUAL_EMERGENCY")
    if error:
        return response(400, {"success": False, "message": error})
    return response(201, {
        "success": True,
        "alertId": item["alertId"],
        "status": item["status"],
        "message": item["message"],
        "alert": item
    })


def handle_get_alerts(event):
    params = event.get("queryStringParameters") or {}
    location = params.get("location")
    status = params.get("status")
    severity = params.get("severity")

    result = table.scan()
    items = result.get("Items", [])
    # Handle pagination on scan (in case table grows)
    while "LastEvaluatedKey" in result:
        result = table.scan(ExclusiveStartKey=result["LastEvaluatedKey"])
        items.extend(result.get("Items", []))

    if location:
        items = [i for i in items if i.get("location") == location]
    if status:
        items = [i for i in items if i.get("status") == status]
    if severity:
        items = [i for i in items if i.get("severity") == severity]

    items.sort(key=lambda i: i.get("createdAt", ""), reverse=True)

    return response(200, {"success": True, "count": len(items), "alerts": items})


def handle_get_alert_by_id(alert_id):
    result = table.get_item(Key={"alertId": alert_id})
    item = result.get("Item")
    if not item:
        return response(404, {"success": False, "message": "Alert not found"})
    return response(200, {"success": True, "alert": item})


def handle_get_stats():
    result = table.scan()
    items = result.get("Items", [])
    while "LastEvaluatedKey" in result:
        result = table.scan(ExclusiveStartKey=result["LastEvaluatedKey"])
        items.extend(result.get("Items", []))

    total_alerts = len(items)
    active_leaks = len([i for i in items if i.get("status") == "ACTIVE" and i.get("eventType") == "WATER_LEAK"])
    resolved_leaks = len([i for i in items if i.get("status") == "RESOLVED"])
    emergency_alerts = len([i for i in items if i.get("eventType") == "MANUAL_EMERGENCY"])

    response_times = [float(i["responseTime"]) for i in items if i.get("responseTime") is not None]
    avg_response_time = round(sum(response_times) / len(response_times), 2) if response_times else 0

    return response(200, {
        "success": True,
        "totalAlerts": total_alerts,
        "activeLeaks": active_leaks,
        "resolvedLeaks": resolved_leaks,
        "emergencyAlerts": emergency_alerts,
        "averageResponseTime": avg_response_time
    })


def handle_resolve(alert_id):
    existing = table.get_item(Key={"alertId": alert_id}).get("Item")
    if not existing:
        return response(404, {"success": False, "message": "Alert not found"})

    resolved_at = now_iso()
    table.update_item(
        Key={"alertId": alert_id},
        UpdateExpression="SET #s = :resolved, resolvedAt = :ts",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":resolved": "RESOLVED", ":ts": resolved_at}
    )

    return response(200, {
        "success": True,
        "alertId": alert_id,
        "status": "RESOLVED",
        "resolvedAt": resolved_at,
        "message": "Alert marked as resolved"
    })


# ---------------------------------------------------------------------------
# Main Lambda Entry Point (routes by HTTP method + path)
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    try:
        http_method = (
            event.get("httpMethod")
            or event.get("requestContext", {}).get("http", {}).get("method")
            or "GET"
        )
        path = event.get("path") or event.get("rawPath") or "/"
        path_params = event.get("pathParameters") or {}

        # Handle CORS preflight
        if http_method == "OPTIONS":
            return response(200, {"message": "OK"})

        # POST /alerts/emergency
        if http_method == "POST" and path.rstrip("/").endswith("/emergency"):
            return handle_post_emergency(event)

        # POST /alerts
        if http_method == "POST" and path.rstrip("/").endswith("/alerts"):
            return handle_post_alerts(event)

        # GET /stats
        if http_method == "GET" and path.rstrip("/").endswith("/stats"):
            return handle_get_stats()

        # PATCH /alerts/{alertId}/resolve
        if http_method == "PATCH" and path.rstrip("/").endswith("/resolve"):
            alert_id = path_params.get("alertId") or path_params.get("id")
            if not alert_id:
                # fallback: parse from path manually
                parts = [p for p in path.split("/") if p]
                if len(parts) >= 2:
                    alert_id = parts[-2]
            return handle_resolve(alert_id)

        # GET /alerts/{alertId}
        if http_method == "GET" and path_params.get("alertId"):
            return handle_get_alert_by_id(path_params.get("alertId"))

        # GET /alerts
        if http_method == "GET" and path.rstrip("/").endswith("/alerts"):
            return handle_get_alerts(event)

        return response(404, {"success": False, "message": f"Route not found: {http_method} {path}"})

    except Exception as e:
        return response(500, {"success": False, "message": "Internal server error", "error": str(e)})
