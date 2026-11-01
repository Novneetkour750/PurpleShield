from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
import sqlite3, hashlib, secrets, json, socket, ipaddress
from datetime import datetime, timezone
from contextlib import contextmanager
import hmac, time
from typing import Annotated

BASE = Path(__file__).resolve().parents[2]
DB_PATH = BASE / "data" / "purpleshield.db"
DB_PATH.parent.mkdir(exist_ok=True)
app = FastAPI(title="PurpleShield API", version="0.1.0", description="Local-first Red, Blue and Purple Team security validation MVP")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
TOKENS = {}
ROLES = {"admin", "red_operator", "blue_analyst", "purple_analyst"}
TOKEN_TTL_SECONDS = 8 * 60 * 60
PROBABLE_PORT_SERVICES = {
    21:'FTP', 22:'SSH', 25:'SMTP', 53:'DNS', 80:'HTTP', 110:'POP3', 143:'IMAP',
    389:'LDAP', 443:'HTTPS', 445:'SMB', 465:'SMTP over TLS', 5000:'development web service',
    5500:'development web server (often Live Server)', 587:'SMTP submission', 636:'LDAPS',
    993:'IMAPS', 995:'POP3S', 1433:'Microsoft SQL Server', 1521:'Oracle Database',
    2049:'NFS', 3306:'MySQL', 3389:'Remote Desktop (RDP)', 5432:'PostgreSQL', 5900:'VNC',
    6379:'Redis', 8000:'HTTP alternate/development web service', 8080:'HTTP alternate/proxy',
    8443:'HTTPS alternate', 9000:'alternate/development web service', 9200:'Elasticsearch',
    11211:'Memcached', 27017:'MongoDB',
}


def now(): return datetime.now(timezone.utc).isoformat()
@contextmanager
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()

def backup_database():
    """Create a consistent SQLite backup before applying a schema migration."""
    if not DB_PATH.exists() or DB_PATH.stat().st_size == 0:
        return None
    backup_path = DB_PATH.with_name(f'{DB_PATH.stem}.backup-{datetime.now().strftime("%Y%m%d-%H%M%S-%f")}{DB_PATH.suffix}')
    source = sqlite3.connect(DB_PATH)
    backup = sqlite3.connect(backup_path)
    try:
        source.backup(backup)
        backup.commit()
    finally:
        backup.close()
        source.close()
    check = sqlite3.connect(f'file:{backup_path.as_posix()}?mode=ro', uri=True)
    try:
        if check.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            backup_path.unlink(missing_ok=True)
            raise RuntimeError('SQLite backup integrity check failed; migration cancelled')
    finally:
        check.close()
    return backup_path

def init_db():
    # Back up only when this version has a schema change to apply. The SQLite
    # backup API also works safely if another local process has the DB open.
    needs_migration = False
    if DB_PATH.exists() and DB_PATH.stat().st_size:
        existing = sqlite3.connect(DB_PATH)
        try:
            tables = {r[0] for r in existing.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if 'validations' in tables:
                needs_migration |= 'finding_id' not in {r[1] for r in existing.execute('PRAGMA table_info(validations)')}
            if 'users' in tables:
                needs_migration |= 'is_active' not in {r[1] for r in existing.execute('PRAGMA table_info(users)')}
            if 'findings' in tables:
                duplicates = existing.execute('SELECT 1 FROM findings WHERE target IS NOT NULL AND port IS NOT NULL GROUP BY target,port HAVING COUNT(*)>1 LIMIT 1').fetchone()
                unique_index = existing.execute("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_findings_target_port'").fetchone()
                needs_migration |= bool(duplicates) or not unique_index
                hint_ports=tuple(PROBABLE_PORT_SERVICES)
                placeholders=','.join('?' for _ in hint_ports)
                old_hints=existing.execute(f"SELECT 1 FROM findings WHERE lower(coalesce(service,'')) IN ('','unknown') AND port IN ({placeholders}) LIMIT 1",hint_ports).fetchone()
                needs_migration |= bool(old_hints)
            if 'incidents' in tables:
                needs_migration |= not {'incident_detections','incident_findings'}.issubset(tables)
        finally:
            existing.close()
    if needs_migration:
        backup_database()
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, event_type TEXT NOT NULL, username TEXT, source_ip TEXT, details TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS detections(id INTEGER PRIMARY KEY, event_id INTEGER, rule_name TEXT, severity TEXT, description TEXT, status TEXT DEFAULT 'Open', created_at TEXT, FOREIGN KEY(event_id) REFERENCES events(id));
        CREATE TABLE IF NOT EXISTS incidents(id INTEGER PRIMARY KEY, title TEXT, severity TEXT, status TEXT DEFAULT 'Open', description TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS findings(id INTEGER PRIMARY KEY, target TEXT, port INTEGER, service TEXT, severity TEXT, description TEXT, status TEXT DEFAULT 'Open', created_at TEXT);
        CREATE TABLE IF NOT EXISTS validations(id INTEGER PRIMARY KEY, scenario TEXT, expected TEXT, observed TEXT, result TEXT, technique_id TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, username TEXT, action TEXT, details TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS assessment_history (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    target TEXT NOT NULL,
    ports_checked TEXT NOT NULL,
    results TEXT NOT NULL,
    open_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
        CREATE TABLE IF NOT EXISTS incident_detections(incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE, detection_id INTEGER NOT NULL REFERENCES detections(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(incident_id,detection_id));
        CREATE TABLE IF NOT EXISTS incident_findings(incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE, finding_id INTEGER NOT NULL REFERENCES findings(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(incident_id,finding_id));
        ''')
        user_columns = {r['name'] for r in c.execute('PRAGMA table_info(users)')}
        if 'is_active' not in user_columns:
            c.execute('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')

        validation_columns = {r['name'] for r in c.execute('PRAGMA table_info(validations)')}
        if 'finding_id' not in validation_columns:
            c.execute('ALTER TABLE validations ADD COLUMN finding_id INTEGER REFERENCES findings(id)')
        # Keep the earliest ID as the stable identity, copy the latest scan's
        # details into it, then remove only redundant finding rows.
        duplicate_keys = c.execute('SELECT target,port FROM findings WHERE target IS NOT NULL AND port IS NOT NULL GROUP BY target,port HAVING COUNT(*)>1').fetchall()
        for key in duplicate_keys:
            rows = c.execute('SELECT * FROM findings WHERE target=? AND port=? ORDER BY created_at DESC,id DESC', (key['target'], key['port'])).fetchall()
            keeper_id = min(row['id'] for row in rows)
            latest = rows[0]
            keeper = next(row for row in rows if row['id'] == keeper_id)
            # A review state is more valuable than the default Open state when
            # merging old duplicate scan rows; timestamps cannot order status edits.
            merged_status = next((row['status'] for row in rows if row['status'] != 'Open'), keeper['status'])
            c.execute('UPDATE findings SET service=?,severity=?,description=?,status=?,created_at=? WHERE id=?', (latest['service'],latest['severity'],latest['description'],merged_status,latest['created_at'],keeper_id))
            c.execute('DELETE FROM findings WHERE target=? AND port=? AND id<>?', (key['target'],key['port'],keeper_id))
        c.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_target_port ON findings(target,port)')
        for finding in c.execute("SELECT id,port,description FROM findings WHERE lower(coalesce(service,'')) IN ('','unknown')").fetchall():
            hint=PROBABLE_PORT_SERVICES.get(finding['port'])
            if hint:
                description=finding['description'] or ''
                if 'Probable service hint:' not in description:
                    description=f'{description} Probable service hint: {hint}; inferred from the port number, not protocol-confirmed.'.strip()
                c.execute('UPDATE findings SET service=?,description=? WHERE id=?',(f'Probable {hint}',description,finding['id']))
        # Link existing brute-force incidents to the matching synthetic detection
        # when the source IP is present in both descriptions.
        legacy_incidents = c.execute("SELECT id,description FROM incidents WHERE title='Possible brute-force activity'").fetchall()
        for incident in legacy_incidents:
            source = (incident['description'] or '').rsplit(' from ',1)
            if len(source) == 2 and source[1].strip():
                detection = c.execute("SELECT id FROM detections WHERE rule_name='Repeated failed logins' AND description LIKE ? ORDER BY id DESC LIMIT 1",(f"%{source[1].strip()}%",)).fetchone()
                if detection:
                    c.execute('INSERT OR IGNORE INTO incident_detections(incident_id,detection_id,created_at) VALUES(?,?,?)',(incident['id'],detection['id'],now()))
        if not c.execute('SELECT id FROM users LIMIT 1').fetchone():
            salt = secrets.token_hex(16)
            digest = hashlib.pbkdf2_hmac('sha256', b'Purple@123', bytes.fromhex(salt), 180000).hex()
            c.execute('INSERT INTO users(username,salt,password_hash,role,created_at) VALUES(?,?,?,?,?)', ('admin',salt,digest,'admin',now()))

def hash_password(password, salt): return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 180000).hex()
def probable_service(port):
    hint=PROBABLE_PORT_SERVICES.get(port)
    return f'Probable {hint}' if hint else 'Unknown'

def tcp_port_open(ip, port):
    family = socket.AF_INET6 if ip.version == 6 else socket.AF_INET
    address = (str(ip), port, 0, 0) if ip.version == 6 else (str(ip), port)
    sock = None
    try:
        sock = socket.socket(family, socket.SOCK_STREAM)
        sock.settimeout(0.35)
        return sock.connect_ex(address) == 0
    except OSError: return False
    finally:
        if sock is not None: sock.close()

def audit(username, action, details=''):
    with db() as c: c.execute('INSERT INTO audit_log(username,action,details,created_at) VALUES(?,?,?,?)',(username,action,details,now()))
def current_user(authorization):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Login required')
    token = authorization[7:]
    session = TOKENS.get(token)
    if not session or session['expires_at'] <= time.time():
        TOKENS.pop(token, None)
        raise HTTPException(401, 'Session expired. Please login again.')

    # Re-check account status and role on every request. This immediately
    # blocks sessions belonging to deactivated users and applies role changes.
    with db() as c:
        account = c.execute(
            'SELECT role, is_active FROM users WHERE username=?',
            (session['username'],)
        ).fetchone()

    if not account or not account['is_active']:
        for active_token, active_session in list(TOKENS.items()):
            if active_session['username'] == session['username']:
                TOKENS.pop(active_token, None)
        raise HTTPException(401, 'Account is inactive. Contact an administrator.')

    if account['role'] not in ROLES:
        TOKENS.pop(token, None)
        raise HTTPException(403, 'Account has an unsupported role')

    session['role'] = account['role']
    return {'username': session['username'], 'role': account['role']}
def require(user, *roles):
    if user['role'] not in roles and user['role'] != 'admin': raise HTTPException(403, 'Your role does not have permission for this action')

class LoginBody(BaseModel): username: str = Field(min_length=1, max_length=80); password: str = Field(min_length=1, max_length=256)
class UserCreateBody(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r'^[A-Za-z0-9_.-]+$')
    password: str = Field(min_length=10, max_length=256)
    role: str = Field(pattern=r'^(admin|red_operator|blue_analyst|purple_analyst)$')


class UserUpdateBody(BaseModel):
    role: str | None = Field(default=None, pattern=r'^(admin|red_operator|blue_analyst|purple_analyst)$')
    is_active: bool | None = None


class EventBody(BaseModel): event_type: str = Field(default='login_failed', max_length=80); username: str = Field(default='unknown', max_length=160); source_ip: str = Field(default='127.0.0.1', max_length=45); details: str = Field(default='', max_length=2000)
class StatusBody(BaseModel): status: str = Field(pattern='^(Open|In Progress|Fixed|Retest Required|Closed)$')
class IncidentLinksBody(BaseModel): detection_ids: list[Annotated[int, Field(strict=True, ge=1)]] = Field(default_factory=list, max_length=100); finding_ids: list[Annotated[int, Field(strict=True, ge=1)]] = Field(default_factory=list, max_length=100)
class FindingStatusBody(BaseModel): status: str = Field(pattern='^(Open|In Progress|Fixed|Retest Required)$')
class LabBody(BaseModel): target: str = Field(default='127.0.0.1', min_length=2, max_length=45); ports: list[Annotated[int, Field(strict=True, ge=1, le=65535)]] = Field(default_factory=lambda: [22,80,443,5000], max_length=20)
class FindingValidationBody(BaseModel): finding_id: int = Field(gt=0)

@app.on_event('startup')
def startup(): init_db()

@app.get('/api/health')
def health(): return {'status':'ok','service':'PurpleShield API','database':'SQLite','timestamp':now()}

@app.post('/api/auth/login')
def login(body: LoginBody):
    with db() as c: row = c.execute('SELECT * FROM users WHERE username=?',(body.username,)).fetchone()
    if not row or not hmac.compare_digest(hash_password(body.password,row['salt']), row['password_hash']): raise HTTPException(401,'Invalid username or password')
    if not row['is_active']:
        raise HTTPException(403, 'This account is inactive. Contact an administrator.')
    if row['role'] not in ROLES: raise HTTPException(403,'Account has an unsupported role')
    token = secrets.token_urlsafe(32); TOKENS[token] = {'username':row['username'],'role':row['role'],'expires_at':time.time()+TOKEN_TTL_SECONDS}
    audit(row['username'],'login','Successful login')
    return {'access_token':token,'token_type':'bearer','username':row['username'],'role':row['role']}

@app.post('/api/auth/logout')
def logout(authorization: str|None=Header(default=None)):
    user=current_user(authorization)
    TOKENS.pop(authorization[7:],None)
    audit(user['username'],'logout','Session revoked')
    return {'message':'Session ended'}

@app.get('/api/me')
def me(authorization: str|None=Header(default=None)):
    return current_user(authorization)

@app.get('/api/dashboard')
def dashboard(authorization: str|None=Header(default=None)):
    u=current_user(authorization)
    with db() as c:
        def count(table, where='1=1'): return c.execute(f'SELECT COUNT(*) n FROM {table} WHERE {where}').fetchone()['n']
        return {'findings':count('findings'),'open_findings':count('findings',"status!='Fixed'"),'events':count('events'),'detections':count('detections'),'open_incidents':count('incidents',"status='Open'"),'validations':count('validations'),'role':u['role']}

@app.post('/api/demo/seed')
def seed(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst','purple_analyst')
    samples=[('login_failed','admin','192.0.2.44','Repeated failed login attempt'),('login_failed','admin','192.0.2.44','Repeated failed login attempt'),('login_failed','admin','192.0.2.44','Repeated failed login attempt'),('login_success','analyst','127.0.0.1','Normal local login'),('file_integrity_change','system','127.0.0.1','Demo file hash mismatch')]
    with db() as c:
        for e in samples: c.execute('INSERT INTO events(event_type,username,source_ip,details,created_at) VALUES(?,?,?,?,?)',(*e,now()))
    run_detection_rules()
    audit(u['username'],'seed_demo','Inserted synthetic demo events')
    return {'message':'Synthetic demo events added. No external systems contacted.','inserted':len(samples)}

def run_detection_rules():
    with db() as c:
        groups=c.execute("SELECT source_ip, COUNT(*) n FROM events WHERE event_type='login_failed' GROUP BY source_ip HAVING COUNT(*)>=3").fetchall()
        for g in groups:
            exists=c.execute("SELECT id FROM detections WHERE rule_name='Repeated failed logins' AND description LIKE ?",(f"%{g['source_ip']}%",)).fetchone()
            if not exists:
                detection_id=c.execute('INSERT INTO detections(event_id,rule_name,severity,description,status,created_at) VALUES(NULL,?,?,?,?,?)',('Repeated failed logins','High',f"At least 3 failed logins observed from {g['source_ip']}",'Open',now())).lastrowid
                incident_id=c.execute('INSERT INTO incidents(title,severity,status,description,created_at) VALUES(?,?,?,?,?)',('Possible brute-force activity','High','Open',f"Repeated failed logins from {g['source_ip']}",now())).lastrowid
                c.execute('INSERT OR IGNORE INTO incident_detections(incident_id,detection_id,created_at) VALUES(?,?,?)',(incident_id,detection_id,now()))
        changes=c.execute("SELECT id,details FROM events WHERE event_type='file_integrity_change'").fetchall()
        for e in changes:
            exists=c.execute('SELECT id FROM detections WHERE event_id=?',(e['id'],)).fetchone()
            if not exists: c.execute('INSERT INTO detections(event_id,rule_name,severity,description,status,created_at) VALUES(?,?,?,?,?,?)',(e['id'],'File integrity change','Medium',e['details'],'Open',now()))

@app.post('/api/blue/events')
def ingest_event(body: EventBody, authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst')
    with db() as c: c.execute('INSERT INTO events(event_type,username,source_ip,details,created_at) VALUES(?,?,?,?,?)',(body.event_type,body.username,body.source_ip,body.details,now()))
    run_detection_rules(); audit(u['username'],'event_ingested',body.event_type)
    return {'message':'Event ingested and detection rules evaluated'}

@app.get('/api/blue/events')
def events(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst')
    with db() as c: rows=c.execute('SELECT * FROM events ORDER BY id DESC LIMIT 100').fetchall()
    return [dict(r) for r in rows]

@app.get('/api/blue/findings')
def blue_findings(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst','purple_analyst')
    with db() as c: rows=c.execute('SELECT * FROM findings ORDER BY id DESC').fetchall()
    return [dict(r) for r in rows]

@app.get('/api/blue/detections')
def detections(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst','purple_analyst')
    with db() as c: rows=c.execute('SELECT * FROM detections ORDER BY id DESC').fetchall()
    return [dict(r) for r in rows]

@app.get('/api/blue/incidents')
def incidents(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst')
    with db() as c:
        rows=c.execute('SELECT * FROM incidents ORDER BY id DESC').fetchall()
        result=[]
        for row in rows:
            item=dict(row)
            item['detection_ids']=[r['detection_id'] for r in c.execute('SELECT detection_id FROM incident_detections WHERE incident_id=? ORDER BY detection_id',(row['id'],))]
            item['finding_ids']=[r['finding_id'] for r in c.execute('SELECT finding_id FROM incident_findings WHERE incident_id=? ORDER BY finding_id',(row['id'],))]
            result.append(item)
    return result

@app.put('/api/blue/incidents/{incident_id}/links')
def update_incident_links(incident_id:int, body:IncidentLinksBody, authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst')
    with db() as c:
        if not c.execute('SELECT id FROM incidents WHERE id=?',(incident_id,)).fetchone(): raise HTTPException(404,'Incident not found')
        for detection_id in set(body.detection_ids):
            if not c.execute('SELECT id FROM detections WHERE id=?',(detection_id,)).fetchone(): raise HTTPException(404,f'Detection {detection_id} not found')
        for finding_id in set(body.finding_ids):
            if not c.execute('SELECT id FROM findings WHERE id=?',(finding_id,)).fetchone(): raise HTTPException(404,f'Finding {finding_id} not found')
        c.execute('DELETE FROM incident_detections WHERE incident_id=?',(incident_id,))
        c.execute('DELETE FROM incident_findings WHERE incident_id=?',(incident_id,))
        linked_at=now()
        c.executemany('INSERT INTO incident_detections(incident_id,detection_id,created_at) VALUES(?,?,?)',[(incident_id,detection_id,linked_at) for detection_id in set(body.detection_ids)])
        c.executemany('INSERT INTO incident_findings(incident_id,finding_id,created_at) VALUES(?,?,?)',[(incident_id,finding_id,linked_at) for finding_id in set(body.finding_ids)])
    audit(u['username'],'incident_links_changed',f'{incident_id}:detections={body.detection_ids}:findings={body.finding_ids}')
    return {'message':'Incident relationships updated','incident_id':incident_id,'detection_ids':sorted(set(body.detection_ids)),'finding_ids':sorted(set(body.finding_ids))}

@app.patch('/api/blue/incidents/{incident_id}')
def update_incident(incident_id:int, body:StatusBody, authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst')
    with db() as c:
        cur=c.execute('UPDATE incidents SET status=? WHERE id=?',(body.status,incident_id))
        if not cur.rowcount: raise HTTPException(404,'Incident not found')
    audit(u['username'],'incident_status_changed',f'{incident_id}:{body.status}')
    return {'message':'Incident status updated'}

@app.post('/api/red/assess-local')
def assess_local(body:LabBody, authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','red_operator')
    # Strict guard: this MVP only permits loopback targets. It performs TCP connect checks, not exploitation.
    try: ip=ipaddress.ip_address(body.target)
    except ValueError: raise HTTPException(400,'Use an IP address. Hostnames are not accepted in this MVP.')
    if not ip.is_loopback: raise HTTPException(403,'Only 127.0.0.1 or ::1 is allowed in this MVP.')
    results=[]
    for port in body.ports:
        if not 1 <= port <= 65535: raise HTTPException(400,'Port must be between 1 and 65535')
        state='open' if tcp_port_open(ip,port) else 'closed'
        results.append({'port':port,'state':state})
        if state=='open':
            hint=PROBABLE_PORT_SERVICES.get(port)
            service=probable_service(port)
            hint_text=f' Probable service hint: {hint}; this is inferred from the port number and is not a protocol-confirmed service.' if hint else ' No common service hint is available for this port.'
            with db() as c:
                c.execute('''INSERT INTO findings(target,port,service,severity,description,status,created_at)
                    VALUES(?,?,?,?,?,?,?)
                    ON CONFLICT(target,port) DO UPDATE SET
                      service=excluded.service, severity=excluded.severity,
                      description=excluded.description, created_at=excluded.created_at''',
                    (str(ip),port,service,'Info',f'Open TCP port detected by local connect check.{hint_text} Review whether this service is required.','Open',now()))
    # Save exactly ONE assessment-history record for this scan. This runs once,
    # after the port loop, so it is saved whether ports were open or closed.
    open_count=sum(1 for item in results if item['state']=='open')
    try:
        with db() as c:
            scan_id=c.execute('''INSERT INTO assessment_history
                (username,target,ports_checked,results,open_count,created_at)
                VALUES(?,?,?,?,?,?)''',
                (u['username'],str(ip),json.dumps(body.ports),json.dumps(results),open_count,now())).lastrowid
    except sqlite3.Error:
        raise HTTPException(500,'The scan finished but its assessment history could not be saved. Please try again.')
    audit(u['username'],'local_port_assessment',str(body.ports))
    return {'scan_id':scan_id,'target':str(ip),'results':results,'note':'Loopback-only TCP connect checks. No exploit attempts or external network traffic.'}

def _load_json_list(text):
    try:
        value=json.loads(text)
        return value if isinstance(value,list) else []
    except (TypeError, ValueError):
        return []

@app.get('/api/red/assessment-history')
def assessment_history(limit: int = Query(default=100, ge=1, le=500), authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','red_operator')
    try:
        with db() as c: rows=c.execute('SELECT * FROM assessment_history ORDER BY created_at DESC, id DESC LIMIT ?',(limit,)).fetchall()
    except sqlite3.Error:
        raise HTTPException(500,'Assessment history could not be read from the database.')
    history=[]
    for row in rows:
        results=_load_json_list(row['results'])
        ports_checked=_load_json_list(row['ports_checked'])
        open_ports=[r.get('port') for r in results if isinstance(r,dict) and r.get('state')=='open']
        closed_ports=[r.get('port') for r in results if isinstance(r,dict) and r.get('state')=='closed']
        history.append({'scan_id':row['id'],'username':row['username'],'target':row['target'],'ports_checked':ports_checked,
                        'results':results,'total_ports':len(ports_checked),'open_count':row['open_count'],
                        'closed_count':len(closed_ports),'open_ports':open_ports,'closed_ports':closed_ports,
                        'created_at':row['created_at']})
    return history

@app.get('/api/red/findings')
def findings(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','red_operator','blue_analyst','purple_analyst')
    with db() as c: rows=c.execute('SELECT * FROM findings ORDER BY id DESC').fetchall()
    return [dict(r) for r in rows]

@app.patch('/api/red/findings/{finding_id}')
def update_finding(finding_id:int, body:FindingStatusBody, authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','blue_analyst')
    with db() as c:
        cur=c.execute('UPDATE findings SET status=? WHERE id=?',(body.status,finding_id))
        if not cur.rowcount: raise HTTPException(404,'Finding not found')
    audit(u['username'],'finding_status_changed',f'{finding_id}:{body.status}')
    return {'message':'Finding status updated'}

@app.patch('/api/blue/findings/{finding_id}')
def update_blue_finding(finding_id:int, body:FindingStatusBody, authorization: str|None=Header(default=None)):
    return update_finding(finding_id, body, authorization)

@app.post('/api/purple/validate-finding')
def validate_finding(body:FindingValidationBody, authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','purple_analyst')
    with db() as c: finding=c.execute('SELECT * FROM findings WHERE id=?',(body.finding_id,)).fetchone()
    if not finding: raise HTTPException(404,'Finding not found')
    try: ip=ipaddress.ip_address(finding['target'])
    except ValueError: raise HTTPException(400,'Finding target is not a valid IP address')
    if not ip.is_loopback: raise HTTPException(403,'Only loopback findings can be retested in this MVP.')
    is_open=tcp_port_open(ip,finding['port'])
    expected='Port closed (remediated)'
    observed='Port open' if is_open else 'Port closed'
    result='FAIL' if is_open else 'PASS'
    validated_at=now()
    with db() as c:
        c.execute('INSERT INTO validations(finding_id,scenario,expected,observed,result,technique_id,created_at) VALUES(?,?,?,?,?,?,?)',
                  (finding['id'],f'Retest finding #{finding["id"]}',expected,observed,result,None,validated_at))
    audit(u['username'],'finding_validation',f'{finding["id"]}:{result}:{observed}')
    return {'finding_id':finding['id'],'expected':expected,'observed':observed,'result':result,'timestamp':validated_at,
            'finding_status':finding['status'],'message':'Validation recorded. Finding status was not changed.'}

@app.post('/api/purple/validate-demo')
def validate_demo(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','purple_analyst')
    with db() as c:
        det=c.execute("SELECT id FROM detections WHERE rule_name='Repeated failed logins' LIMIT 1").fetchone()
        observed='Detected' if det else 'Not detected'
        result='PASS' if det else 'GAP'
        c.execute('INSERT INTO validations(scenario,expected,observed,result,technique_id,created_at) VALUES(?,?,?,?,?,?)',('Synthetic repeated-login scenario','Detection alert',observed,result,'T1110',now()))
    audit(u['username'],'purple_validation',result)
    return {'scenario':'Synthetic repeated-login scenario','expected':'Detection alert','observed':observed,'result':result,'mitre_attack_id':'T1110','explanation':'T1110 is MITRE ATT&CK Brute Force. This is a synthetic tabletop-style validation, not a real attack.'}

@app.get('/api/purple/validations')
def validations(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin','purple_analyst')
    with db() as c: rows=c.execute('SELECT * FROM validations ORDER BY id DESC').fetchall()
    return [dict(r) for r in rows]

@app.get('/api/admin/users')
def admin_list_users(authorization: str|None=Header(default=None)):
    u = current_user(authorization)
    require(u, 'admin')
    with db() as c:
        rows = c.execute(
            "SELECT id, username, role, is_active, created_at FROM users ORDER BY id ASC"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post('/api/admin/users', status_code=201)
def admin_create_user(body: UserCreateBody, authorization: str|None=Header(default=None)):
    u = current_user(authorization)
    require(u, 'admin')

    username = body.username.strip()
    if not username:
        raise HTTPException(400, 'Username cannot be empty')

    salt = secrets.token_hex(16)
    password_digest = hash_password(body.password, salt)
    try:
        with db() as c:
            user_id = c.execute(
                "INSERT INTO users(username, salt, password_hash, role, created_at, is_active) VALUES(?,?,?,?,?,1)",
                (username, salt, password_digest, body.role, now())
            ).lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409, 'A user with this username already exists')

    audit(u['username'], 'user_created', f'user_id={user_id}; username={username}; role={body.role}')
    return {
        'message': 'User created successfully',
        'user': {'id': user_id, 'username': username, 'role': body.role, 'is_active': True}
    }


@app.patch('/api/admin/users/{user_id}')
def admin_update_user(user_id: int, body: UserUpdateBody, authorization: str|None=Header(default=None)):
    u = current_user(authorization)
    require(u, 'admin')

    if body.role is None and body.is_active is None:
        raise HTTPException(400, 'Provide role or is_active to update')

    with db() as c:
        target = c.execute(
            'SELECT id, username, role, is_active FROM users WHERE id=?',
            (user_id,)
        ).fetchone()
        if not target:
            raise HTTPException(404, 'User not found')

        new_role = body.role if body.role is not None else target['role']
        new_active = int(body.is_active) if body.is_active is not None else target['is_active']

        if target['username'] == u['username'] and (new_role != 'admin' or not new_active):
            raise HTTPException(400, 'You cannot change your own account from active admin status')

        remains_active_admin = c.execute(
            "SELECT COUNT(*) AS total FROM users WHERE role='admin' AND is_active=1 AND id<>?",
            (user_id,)
        ).fetchone()['total']

        if target['role'] == 'admin' and target['is_active'] and (new_role != 'admin' or not new_active) and remains_active_admin == 0:
            raise HTTPException(400, 'The last active administrator cannot be demoted or deactivated')

        c.execute(
            'UPDATE users SET role=?, is_active=? WHERE id=?',
            (new_role, new_active, user_id)
        )

    if new_role != target['role']:
        audit(u['username'], 'user_role_changed', f'user_id={user_id}; username={target["username"]}; {target["role"]}->{new_role}')
    if new_active != target['is_active']:
        action = 'user_activated' if new_active else 'user_deactivated'
        audit(u['username'], action, f'user_id={user_id}; username={target["username"]}')

    # Tokens are checked against the database on every request. Remove them
    # immediately as an extra safeguard when an account is deactivated.
    if not new_active:
        for active_token, active_session in list(TOKENS.items()):
            if active_session['username'] == target['username']:
                TOKENS.pop(active_token, None)

    return {
        'message': 'User updated successfully',
        'user': {
            'id': user_id,
            'username': target['username'],
            'role': new_role,
            'is_active': bool(new_active)
        }
    }


@app.get('/api/audit')
def audit_records(authorization: str|None=Header(default=None)):
    u=current_user(authorization); require(u,'admin')
    with db() as c: rows=c.execute('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').fetchall()
    return [dict(r) for r in rows]
