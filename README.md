# PurpleShield
## Security Validation and Purple Team Assessment Platform

## Overview

PurpleShield is a cybersecurity platform designed to integrate Red Team, Blue Team, and Purple Team activities into a unified security validation environment.

The platform focuses on localhost-based network assessment, security event monitoring, detection management, incident tracking, and remediation validation. It also includes a Local Agent that performs TCP port checks on a local machine and communicates scan results to the backend.

The objective is to provide a centralized environment for security assessment, monitoring, and validation.

## Key Features

### Red Team
- Localhost-only TCP port assessment.
- Identification of open and filtered ports.
- Security finding creation and updates.
- Repeated assessment support.

### Blue Team
- Security event collection.
- Synthetic security event generation.
- Detection rule execution.
- Detection and incident management.
- Findings monitoring.

### Purple Team
- Selection of existing security findings.
- Remediation retesting.
- PASS/FAIL validation records.
- Security validation workflow.

### Local Agent
- Local device identification.
- TCP port scanning.
- Collection of port assessment results.
- Communication with the deployed backend.
- Centralized scan result reporting and analytics.

### Platform Management
- Authentication APIs.
- User and role-related functionality.
- Audit logging.
- Centralized application records.

## Technology Stack

| Component | Technology |
|---|---|
| Programming Language | Python |
| Backend Framework | FastAPI |
| Frontend | HTML, CSS, JavaScript |
| Database | SQLite |
| ASGI Server | Uvicorn |
| Development Environment | IBM Bob |
| Version Control | Git and GitHub |
| Deployment Platform | Render |

## System Architecture

PurpleShield follows a frontend-backend architecture in which the frontend communicates with the FastAPI backend through REST APIs.

```text
             USER
               |
               v
        FRONTEND APPLICATION
          HTML / CSS / JS
               |
               v
         FASTAPI BACKEND
               |
       +-------+--------+
       |       |        |
       v       v        v
    RED TEAM BLUE TEAM PURPLE TEAM
       |       |        |
       +-------+--------+
               |
               v
         SQLITE DATABASE
               ^
               |
          LOCAL AGENT
               |
       Local TCP Assessment
```

### Application Components

- **Frontend:** Provides the web interface for interacting with the platform.
- **Backend:** Handles API requests, application logic, assessment operations, and database communication.
- **Database:** Stores application records such as users, events, detections, incidents, findings, validations, and audit entries.
- **Local Agent:** Performs local TCP assessments and submits results to the backend.
- **Red Team:** Performs localhost-based security assessments.
- **Blue Team:** Processes security events and detections.
- **Purple Team:** Supports finding retesting and validation.

## Project Structure

The following represents the currently identified backend structure:

```text
PurpleShield/
│
├── backend/
│   │
│   ├── app/
│   │   └── main.py
│   │
│   ├── data/
│   │   └── purpleshield.db
│   │
│   ├── agent.py
│   │
│   └── connect_agent.py
│
├── frontend/
│   └── Frontend application files
│
└── README.md
```

### Important Files and Their Responsibilities

| File / Directory | Purpose |
|---|---|
| `app/main.py` | Main FastAPI backend application, API endpoints and application logic. |
| `agent.py` | Local Agent implementation for local TCP assessment. |
| `connect_agent.py` | Handles Local Agent communication and connection with the backend. |
| `data/purpleshield.db` | SQLite database used for storing application data. |
| `frontend/` | Contains the web interface built using HTML, CSS and JavaScript. |

Note: The frontend structure is represented at directory level. Update this section with exact frontend filenames if needed.

## Local Agent Workflow

The Local Agent performs TCP port checks on the local machine and sends the collected results to the deployed backend.

Example assessment performed:

| Parameter | Result |
|---|---|
| Device | DESKTOP-4FKQOUV |
| Target IP | 127.0.0.1 |
| Port 22 | Filtered |
| Port 80 | Filtered |
| Port 5000 | Open |
| Port 8000 | Filtered |

The deployed backend successfully acknowledged receiving four port assessment results.

## Implementation and Testing

The following development and testing activities have been performed:

- FastAPI backend health endpoint tested successfully.
- Python syntax compilation completed for `main.py`, `agent.py`, and `connect_agent.py`.
- Local Agent successfully performed a localhost TCP scan.
- Backend successfully received four scan results.
- Local Agent Results dashboard displayed scan information.
- Blue Team Local Agent Analytics displayed scan statistics.
- Login API returned HTTP 200 OK.

### Testing In Progress

- Authentication identity verification (`GET /api/me` returned HTTP 401 during testing).
- Finding-to-validation workflow.
- Complete integration between application modules.
- Comprehensive automated testing.

The project is currently undergoing further development and testing.

## Deployment

PurpleShield is deployed using Render.

| Service | URL |
|---|---|
| Live Application | https://purpleshield-1.onrender.com |
| Backend API | https://purpleshield.onrender.com |
| Backend Health Check | https://purpleshield.onrender.com/api/health |

The frontend provides the application interface, while the backend handles API requests and database operations.

## Future Enhancements

- Complete end-to-end integration of all modules.
- Improve authentication and authorization verification.
- Expand security detection capabilities.
- Enhance incident management and reporting.
- Improve service identification.
- Implement comprehensive automated testing.
- Extend security assessment capabilities.

## Conclusion

PurpleShield provides a foundation for integrating security assessment, event monitoring, incident tracking, and remediation validation into a unified cybersecurity platform.

The project combines Red Team, Blue Team, and Purple Team concepts with Local Agent integration to support a structured security validation workflow.

---
