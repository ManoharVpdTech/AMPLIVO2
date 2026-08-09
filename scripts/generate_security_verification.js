// Generates AMPLIVO_SECURITY_VERIFICATION.csv — evidence ledger for the
// security + observability remediation pass (2026-08-09). Run from repo root:
//   node scripts/generate_security_verification.js
const fs = require('fs');
const path = require('path');

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return '"' + str.replace(/"/g, '""') + '"';
}

function writeCsvFile(fileName, headers, rowsData) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rowsData) {
    lines.push(row.map(escapeCsv).join(','));
  }
  const csvContent = '\uFEFF' + lines.join('\n');
  const filePath = path.join(process.cwd(), 'temp', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csvContent, 'utf8');
  console.log(`Successfully generated temp/${fileName} with ${rowsData.length} rows.`);
}

const headers = [
  'ID', 'OWASP', 'Finding', 'Fix', 'Verification', 'Result', 'Evidence'
];

const rows = [
  ['SEC-01', 'A03', 'SQL injection on login identifier', 'Parameterized queries / no string interpolation', 'Security regression suite', 'PASS', 'test_sql_injection.py (4 tests): payload set -> 401/422/429, never auth'],
  ['SEC-02', 'A03', 'SQL injection via register username', 'Username validation pattern', 'Security regression suite', 'PASS', 'register rejects payloads with validation error, never 201'],
  ['SEC-03', 'A03', 'Search/list endpoints SQLi', 'ORM-only queries', 'Security regression suite', 'PASS', 'check-email treats payloads as plain text (200/422), no SQL error'],
  ['SEC-04', 'A03', 'Stored XSS via registration full_name', 'Output encoding / scoped sanitizer', 'Security regression suite', 'PASS', 'test_xss.py: raw <script> not re-emitted; benign <b> accepted'],
  ['SEC-05', 'A03', 'Reflected XSS on failed login', 'Error responses escape payloads', 'Security regression suite', 'PASS', 'login failure does not reflect <script> verbatim'],
  ['SEC-06', 'A08', 'File upload stored XSS (.html/.svg)', 'Extension + MIME allowlist, uuid+ext stored names, attachment Content-Disposition', 'test_file_upload_allowlist.py', 'PASS', '5 tests green; _HardenedStaticFiles forces nosniff'],
  ['SEC-07', 'A02', 'Unauthenticated /auth/me accessible', 'get_current_user dependency', 'Security regression suite', 'PASS', 'no/garbage/forged/expired token -> 401/403'],
  ['SEC-08', 'A07', 'JWT forged with attacker secret', 'Verify signature against JWT_SECRET_KEY', 'Security regression suite', 'PASS', 'test_auth_bypass.py forged-signature -> 401'],
  ['SEC-09', 'A01', 'Cross-tenant activity-log read (BAC-1)', 'get_log scoped by current_user when tenant-scoped', 'Security regression suite', 'PASS', 'test_idor_rbac.py: foreign UUID -> 403/404'],
  ['SEC-10', 'A01', 'Non-admin creates/deletes activity logs', 'require_roles("admin") on writes', 'Security regression suite', 'PASS', 'client role -> 403'],
  ['SEC-11', 'A02', 'hashed_password leaked in responses', 'Response schemas exclude sensitive columns', 'Security regression suite', 'PASS', 'test_sensitive_data.py: register/me bodies have no password fields'],
  ['SEC-12', 'A05', 'Secrets echo in public responses', 'No debug endpoints', 'Security regression suite', 'PASS', 'health/check-email bodies do not contain secret field names'],
  ['SEC-13', 'A05', 'Boot with empty JWT secret in prod', 'Fail-closed validator', 'Security regression suite', 'PASS', 'Settings() raises ValueError in production'],
  ['SEC-14', 'A05', 'Boot with placeholder DATABASE_URL in prod', 'Fail-closed validator', 'Security regression suite', 'PASS', 'Settings() raises ValueError in production'],
  ['SEC-15', 'A09', 'Sentry event leaks auth headers/PII', 'before_send scrubber', 'Security regression suite', 'PASS', 'test_sensitive_data.py scrubber redacts Authorization/Cookie/credential fields/email'],
  ['SEC-16', 'A02', 'Leaked DB password could reappear', 'SHA-256 digest guard in CI', 'local run', 'PASS', 'secret-digest-guard.py: 761 tracked files scanned, 0 hits; planted copy -> 1 hit'],
  ['SEC-17', 'A02', 'Live Google Maps key in Lighthouse JSONs', 'git rm --cached + .gitignore + on-disk sanitize', 'file audit', 'PASS', '0 live tokens on disk; files untracked and ignored'],
  ['SEC-18', 'A09', 'No error tracking (backend)', 'Sentry SDK env-gated + unhandled-500 capture', 'build + import', 'PASS', 'sentry-sdk[fastapi]==2.24.1 installed; import verified'],
  ['SEC-19', 'A09', 'No error tracking (frontend)', '@sentry/nextjs server/client/edge + global-error capture', 'tsc + build', 'PASS', 'tsc --noEmit clean; next build succeeds with instrumentation'],
  ['SEC-20', 'A09', 'Logs only to ephemeral stderr', 'HTTP batch log forwarder', 'code review', 'DONE', 'log_forwarder.py batched shipping, redaction, off unless LOG_FORWARD_URL'],
  ['SEC-21', 'A04', 'X-Forwarded-For IP spoofing vs rate limit', 'Trusted-proxy-gated client IP', 'code review', 'PASS', 'TRUSTED_PROXIES honored only from trusted direct peer'],
  ['SEC-22', 'A03', 'dangerouslySetInnerHTML XSS vector (frontend)', 'ESLint rule (style-only allowed)', 'eslint', 'PASS', 'rule fires on <div dangerouslySetInnerHTML>; <style> allowed'],
  ['SEC-23', 'regression', 'Full backend suite', 'All of the above', 'pytest', 'PASS', '216 passed, 0 failed'],
];

writeCsvFile('AMPLIVO_SECURITY_VERIFICATION.csv', headers, rows);
console.log('\n--- SECURITY VERIFICATION SUMMARY ---');
console.log('Rows:', rows.length);
console.log('PASS:', rows.filter((r) => r[5] === 'PASS').length);
console.log('DONE:', rows.filter((r) => r[5] === 'DONE').length);
