# Backend — Lambda Function

## File
`lambda_function.py`

## Runtime
Python 3.12 (any Python 3.x works)

## Handler
`lambda_function.lambda_handler`

## Environment Variables
| Key | Value |
|---|---|
| `TABLE_NAME` | `HostelWaterLeakAlerts` |

## IAM Permissions Needed
Attach a role to this Lambda with:
- `AmazonDynamoDBFullAccess` (or a scoped custom policy — see `deployment/AWS-DEPLOYMENT.md`)
- `AWSLambdaBasicExecutionRole` (for CloudWatch Logs)

## Routing Logic
This is a **single Lambda function** that routes internally based on HTTP method + path:

| Method | Path | Action |
|---|---|---|
| POST | `/alerts` | Create a water-leak alert |
| POST | `/alerts/emergency` | Create a manual emergency alert |
| GET | `/alerts` | List alerts (supports `?location=&status=&severity=`) |
| GET | `/alerts/{alertId}` | Get one alert |
| GET | `/stats` | Return aggregate statistics |
| PATCH | `/alerts/{alertId}/resolve` | Mark an alert resolved |

## Local Test (optional)
You can test the handler function locally by importing it and passing a mock
API Gateway event dict — not required for deployment, AWS Console deployment
is sufficient.

## Deployment
See `/deployment/AWS-DEPLOYMENT.md` for full step-by-step AWS Console instructions.
