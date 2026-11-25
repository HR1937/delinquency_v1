import fs from 'fs';
import path from 'path';

const dirs = [
  'C:/Users/hetvi/Desktop',
  'C:/Users/hetvi/Downloads',
  'C:/Users/hetvi/Documents',
  'R:/out-intern-delinquency-proj2'
];

function searchDir(d: string, depth = 0) {
  if (depth > 4) return;
  try {
    const list = fs.readdirSync(d);
    for (const item of list) {
      if (item === 'node_modules' || item === '.git' || item === 'dist' || item === '.gemini') continue;
      const full = path.join(d, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        searchDir(full, depth + 1);
      } else if (stat.isFile() && (item.endsWith('.txt') || item.endsWith('.json') || item.endsWith('.csv') || item.endsWith('.md') || item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.env'))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('4477')) {
            console.log(`FOUND 4477 in file: ${full}`);
            const lines = content.split('\n');
            lines.forEach((l, idx) => {
              if (l.includes('4477')) console.log(`  Line ${idx + 1}: ${l.slice(0, 150)}`);
            });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

for (const d of dirs) {
  searchDir(d);
}
console.log('Search finished.');
process.exit(0);
