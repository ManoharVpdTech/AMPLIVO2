const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.SONAR_TOKEN;
if (!token) {
  console.error('SONAR_TOKEN environment variable is required.');
  process.exit(1);
}
const projectKey = process.env.SONAR_PROJECT_KEY || 'johnalexanderkondepoguVPD_AMPLIVO';
const ruleMap = new Map();
let allIssues = [];

async function fetchPage(page) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sonarcloud.io',
      path: `/api/issues/search?componentKeys=${projectKey}&ps=500&p=${page}`,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    };
    https
      .get(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`API status code: ${res.statusCode} body: ${body}`));
          }
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('Starting retrieval of all SonarCloud issues...');
  let page = 1;
  let total = 0;

  while (true) {
    const data = await fetchPage(page);
    total = data.total;

    if (data.rules) {
      for (const r of data.rules) {
        ruleMap.set(r.key, r.name);
      }
    }

    const issues = data.issues || [];
    allIssues = allIssues.concat(issues);
    console.log(`Page ${page} fetched. Issues retrieved so far: ${allIssues.length} / ${total}`);

    if (allIssues.length >= total || issues.length === 0) {
      break;
    }
    page++;
  }

  console.log('All issues retrieved. Total count:', allIssues.length);

  const severityRank = {
    BLOCKER: 1,
    CRITICAL: 2,
    MAJOR: 3,
    MINOR: 4,
    INFO: 5,
  };

  allIssues.sort((a, b) => {
    const sevA = severityRank[a.severity] || 99;
    const sevB = severityRank[b.severity] || 99;
    if (sevA !== sevB) return sevA - sevB;

    const statA = (a.status || '').localeCompare(b.status || '');
    if (statA !== 0) return statA;

    const fileA = a.component && a.component.includes(':') ? a.component.split(':')[1] : (a.component || '');
    const fileB = b.component && b.component.includes(':') ? b.component.split(':')[1] : (b.component || '');
    return fileA.localeCompare(fileB);
  });

  function escapeCsv(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return '"' + str.replace(/"/g, '""') + '"';
  }

  const headers = [
    'Issue Key',
    'Rule ID',
    'Rule Name',
    'Issue Type',
    'Severity',
    'Status',
    'Resolution',
    'Project',
    'Project Key',
    'Branch',
    'Component',
    'File Path',
    'Line Number',
    'Message',
    'Technical Debt',
    'Effort',
    'Author',
    'Assignee',
    'Tags',
    'Creation Date',
    'Update Date',
    'Close Date',
    'Clean Code Attribute',
    'Software Quality',
    'SonarCloud Issue URL',
  ];

  const rows = [headers.map(escapeCsv).join(',')];

  for (const iss of allIssues) {
    const filePath = iss.component && iss.component.includes(':') ? iss.component.split(':')[1] : (iss.component || '');
    const ruleName = ruleMap.get(iss.rule) || iss.rule;
    const tagsStr = Array.isArray(iss.tags) ? iss.tags.join(', ') : '';
    const impactsStr = Array.isArray(iss.impacts)
      ? iss.impacts.map((i) => `${i.softwareQuality || ''}:${i.severity || ''}`).join('; ')
      : '';
    const issueUrl = `https://sonarcloud.io/project/issues?id=${projectKey}&open=${iss.key}`;

    const row = [
      iss.key || '',
      iss.rule || '',
      ruleName,
      iss.type || '',
      iss.severity || '',
      iss.status || '',
      iss.resolution || '',
      iss.projectName || 'AMPLIVO',
      iss.project || projectKey,
      'main',
      iss.component || '',
      filePath,
      iss.line || '',
      iss.message || '',
      iss.debt || '',
      iss.effort || '',
      iss.author || '',
      iss.assignee || '',
      tagsStr,
      iss.creationDate || '',
      iss.updateDate || '',
      iss.closeDate || '',
      iss.cleanCodeAttribute || '',
      impactsStr,
      issueUrl,
    ];
    rows.push(row.map(escapeCsv).join(','));
  }

  const csvContent = '\uFEFF' + rows.join('\n');
  const outputPath = path.join(process.cwd(), 'AMPLIVO_SONARCLOUD_ANALYSIS.csv');
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  console.log('Successfully written CSV file to:', outputPath);

  let openCount = 0;
  let resolvedCount = 0;
  let closedCount = 0;
  let bugCount = 0;
  let vulnCount = 0;
  let codeSmellCount = 0;
  let hotspotCount = 0;

  for (const iss of allIssues) {
    const st = (iss.status || '').toUpperCase();
    const tp = (iss.type || '').toUpperCase();

    if (st === 'OPEN' || st === 'REOPENED') openCount++;
    else if (st === 'RESOLVED') resolvedCount++;
    else if (st === 'CLOSED') closedCount++;

    if (tp === 'BUG') bugCount++;
    else if (tp === 'VULNERABILITY') vulnCount++;
    else if (tp === 'CODE_SMELL') codeSmellCount++;
    else if (tp === 'SECURITY_HOTSPOT') hotspotCount++;
  }

  console.log('\n--- SONARCLOUD ANALYSIS SUMMARY REPORT ---');
  console.log('Total Issues Exported:', allIssues.length);
  console.log('Open Issues:', openCount);
  console.log('Resolved Issues:', resolvedCount);
  console.log('Closed Issues:', closedCount);
  console.log('Bugs:', bugCount);
  console.log('Vulnerabilities:', vulnCount);
  console.log('Code Smells:', codeSmellCount);
  console.log('Security Hotspots:', hotspotCount);
  console.log('API Total vs Exported Rows Match:', total === allIssues.length ? 'VERIFIED (EXACT MATCH)' : 'MISMATCH');
}

main().catch((err) => console.error('Error:', err));
