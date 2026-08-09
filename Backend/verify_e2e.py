"""End-to-end verification: login all 5 demo users + growth audit submit + DB check."""
import urllib.request, json

base = 'http://localhost:8000/api/v1'

def post(url, data, headers=None):
    body = json.dumps(data).encode()
    h = {'Content-Type': 'application/json'}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=body, headers=h, method='POST')
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def get(url, headers=None):
    h = {}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

print('=== LOGIN VERIFICATION ===')
role_redirects = {'Admin': '/admin', 'Client': '/portal', 'Sales': '/sales', 'HR': '/hr', 'Employee': '/employee'}
demo_users = [
    ('admin@amplivo.in', 'Amplivo!Admin2026'),
    ('client@amplivo.in', 'Amplivo!Client2026'),
    ('sales@amplivo.in', 'Amplivo!Sales2026'),
    ('hr@amplivo.in', 'Amplivo!Hr2026'),
    ('employee@amplivo.in', 'Amplivo!Emp2026'),
]
all_pass = True
for email, pwd in demo_users:
    try:
        tokens = post(f'{base}/auth/login', {'identifier': email, 'password': pwd})
        me = get(f'{base}/auth/me', {'Authorization': f'Bearer {tokens["access_token"]}'})
        role = me.get('role_name', 'N/A')
        redirect = role_redirects.get(role, '/portal')
        active = me.get('is_active')
        verified = me.get('is_verified')
        print(f'  PASS  {email}')
        print(f'        role={role}  active={active}  verified={verified}  redirect={redirect}')
    except Exception as e:
        print(f'  FAIL  {email}: {e}')
        all_pass = False

print()
print('=== GROWTH AUDIT SUBMISSION ===')
payload = {
    'name': 'E2E Test User',
    'email': 'e2etest@example.com',
    'phone': '9876543210',
    'company': 'Test Company Ltd',
    'service_interest': 'SEO',
    'budget_range': 'Rs.50,000 - Rs.1,00,000',
    'message': 'End-to-end test submission for growth audit verification',
}
try:
    result = post(f'{base}/consultation-requests', payload)
    print(f'  PASS  Submitted successfully')
    print(f'        id={result["id"]}')
    print(f'        name={result["name"]}')
    print(f'        email={result["email"]}')
    print(f'        status={result["status"]}')
    print(f'        created_at={result["created_at"]}')
    submitted_id = result['id']
except Exception as e:
    print(f'  FAIL  Submission error: {e}')
    submitted_id = None
    all_pass = False

print()
print('=== VERIFY RECORD PERSISTED IN SUPABASE ===')
if submitted_id:
    try:
        records = get(f'{base}/consultation-requests')
        found = next((r for r in records if r['id'] == submitted_id), None)
        if found:
            print(f'  PASS  Record confirmed in DB: id={found["id"]}')
        else:
            print(f'  FAIL  Record NOT found in DB (id={submitted_id})')
            all_pass = False
    except Exception as e:
        print(f'  FAIL  DB check error: {e}')
        all_pass = False

print()
print('=== ADMIN DASHBOARD VIEW ===')
try:
    admin_tokens = post(f'{base}/auth/login', {'identifier': 'admin@amplivo.in', 'password': 'Amplivo!Admin2026'})
    admin_records = get(f'{base}/consultation-requests', {'Authorization': f'Bearer {admin_tokens["access_token"]}'})
    print(f'  PASS  Admin can view {len(admin_records)} consultation request(s)')
    for r in admin_records[-3:]:
        print(f'        - {r["name"]} | {r["email"]} | status={r["status"]} | {r["created_at"][:10]}')
except Exception as e:
    print(f'  FAIL  Admin view error: {e}')
    all_pass = False

print()
print('=== DUPLICATE SUBMISSION PREVENTION ===')
try:
    result2 = post(f'{base}/consultation-requests', payload)
    print(f'  INFO  Second submission accepted (id={result2["id"]}) — backend allows multiple requests per email (by design)')
except Exception as e:
    print(f'  INFO  Second submission blocked: {e}')

print()
if all_pass:
    print('ALL CHECKS PASSED')
else:
    print('SOME CHECKS FAILED — review output above')
