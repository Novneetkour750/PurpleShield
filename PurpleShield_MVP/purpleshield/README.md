# PurpleShield

**Integrated Red Team, Blue Team and Purple Team Security Validation Platform** — local-first educational MVP.

## What works in this MVP
- Local sign-in with PBKDF2-HMAC-SHA256 password hashing and role labels.
- SQLite persistence for users, events, detections, incidents, findings, validations and audit records.
- Red Team: TCP connect checks against loopback (`127.0.0.1` / `::1`) only. No exploitation.
- Red findings are deduplicated by target IP and port and are shared with Blue Team for review.
- Common ports receive a **probable** service hint based on the port number; PurpleShield does not claim protocol-level service detection.
- Blue Team: synthetic event ingestion, simple transparent rules for repeated failed logins and file-integrity-change events, incident tracking.
- Incidents can link to multiple detections and findings through SQLite relationship tables; generated repeated-login incidents are linked to their detection automatically.
- Purple Team: retests existing Red findings by checking whether the local TCP port remains open, and records PASS/FAIL history without changing finding status. Synthetic repeated-login validation remains available and is linked to MITRE ATT&CK T1110 (Brute Force).
- Dashboard tying the modules together.

## Requirements
- Windows 10/11
- Python 3.10+

## Run on Windows
1. Extract the ZIP.
2. Open the `purpleshield` folder in VS Code.
3. Open Terminal and run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload
```

4. Open `frontend/index.html` in a browser. If browser restrictions prevent API requests, run a local static server from the project root in a second terminal:

```powershell
py -m http.server 5500 --directory frontend
```

Then open http://127.0.0.1:5500.

API docs: http://127.0.0.1:8000/docs
Health check: http://127.0.0.1:8000/api/health

## Demo login
- Username: `admin`
- Password: `Purple@123`

Change this demo credential before using the project beyond a local classroom demonstration. Opaque bearer sessions are held in process memory, expire after 8 hours, and are revoked when the user logs out. Restarting the backend clears all sessions.

## Suggested demo flow
1. Sign in.
2. Red Team → assess localhost ports (only loopback is permitted).
3. Blue Team → review the new finding and set its status.
4. Purple Team → select that finding and retest it; close the service first for PASS, or leave it open for FAIL.
5. Overview → **Load demo security events**, then use Blue Team to review detections/incidents and Purple Team → **Run validation** for the synthetic repeated-login scenario.

## Tests

From the project root in PowerShell, run:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
```

The tests cover Red-to-Blue-to-Purple findings, duplicate scans, analyst status updates, remediation retests, backup and migration behavior, authentication/session handling, role permissions, synthetic events, detections, incidents, SQLite cross-process persistence, SQL injection resistance, and the loopback-only assessment guard. Automated TCP outcomes are simulated because the test environment restricts local sockets; the application itself performs loopback-only connect checks.

Install the test-only HTTP client before running the suite:

```powershell
python -m pip install -r backend\requirements-test.txt
```

## Database migration

On first startup after this workflow update, the backend backs up the existing SQLite database before schema changes, verifies the backup, consolidates duplicate target/port findings, adds a unique target/port index and nullable validation-to-finding link, and creates the incident-to-detection and incident-to-finding join tables. Existing brute-force incidents are linked to matching detections when the source IP matches. Existing users, events, detections, incidents, findings, validations, and audit records are retained. Backups are written beside `data/purpleshield.db` with a `.backup-<timestamp>.db` name.

## Safety
Only use the Red Team function on your own local machine. The backend rejects non-loopback IPs and hostnames. It performs a basic TCP connection check only. Do not remove this restriction or test systems without written authorisation.

## Current limitations / next development phase
This is a functional MVP, not a production SIEM or vulnerability scanner. It does not perform network-wide monitoring, exploit validation, real ML anomaly detection, automated remediation, production-grade JWT/session management, password reset, or full role-specific UI navigation. The current detection rules are deliberately simple and explainable. Next steps: improve RBAC, add unit tests, add safe lab asset inventory, evidence/report export, then evaluate ML against labelled synthetic events.
