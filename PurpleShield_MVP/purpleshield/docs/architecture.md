# PurpleShield MVP architecture

```text
Browser (HTML/CSS/JavaScript)
        | REST / JSON + bearer token
        v
FastAPI backend
  |-- Auth + role checks + audit log
  |-- Red: loopback TCP connect assessment -> findings
  |-- Blue: event ingestion -> transparent detection rules -> incidents
  |-- Purple: synthetic scenario validation -> ATT&CK mapping
        |
        v
     SQLite
```

Red findings and Blue incidents/detections are persisted in the same database and surfaced in the common dashboard. Purple validation reads Blue detection state to decide PASS/GAP. The design keeps the modules separated by API route groups so later services can be introduced without changing the user workflow.
