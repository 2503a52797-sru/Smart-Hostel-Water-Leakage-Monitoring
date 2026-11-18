# Frontend — Dashboard

Pure HTML5 + CSS3 + Vanilla JavaScript. No frameworks, no build step.

## Files
- `index.html` — dashboard structure
- `style.css` — dark, modern responsive styling
- `script.js` — all API logic (fetch calls, rendering, filters)

## Required Configuration
Open `script.js` and set your API Gateway Invoke URL at the top:

```js
const API_BASE_URL = "YOUR_API_GATEWAY_URL";
```

Example:
```js
const API_BASE_URL = "https://abc123xyz.execute-api.ap-south-1.amazonaws.com";
```

No trailing slash. No AWS keys are ever stored in this file — only the public API URL.

## Running on EC2 (what you asked for)
These are plain static files, so any web server works. The simplest option on an
EC2 instance is Nginx. Full step-by-step EC2 instructions are in
`/deployment/AWS-DEPLOYMENT.md` (Part B).

## Running Locally (for quick testing before deployment)
Since this is plain static HTML/CSS/JS, you can also just open `index.html`
directly in a browser, or serve it locally:

```bash
cd frontend
python3 -m http.server 8080
```
Then visit `http://localhost:8080`.

Either way, the dashboard will call whatever `API_BASE_URL` you configured —
it works the same locally, on EC2, or on S3.
