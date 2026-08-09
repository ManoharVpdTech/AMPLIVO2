const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (fullPath.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const adminDir = path.join(process.cwd(), 'src', 'app', 'admin');
const files = walk(adminDir);

let changed = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('grid-cols-2 gap-4')) {
    content = content.replace(/className="grid grid-cols-2 gap-4"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-4"');
    fs.writeFileSync(file, content);
    changed++;
  }
});
console.log(`Updated ${changed} files.`);
