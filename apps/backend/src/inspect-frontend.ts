import fs from 'fs';

const app = fs.readFileSync('../frontend/src/App.tsx', 'utf8');
const lines = app.split('\n');

lines.forEach((l, i) => {
  if (l.includes("setActiveTab('") || l.includes('sidebar-nav-btn')) {
    console.log(`Line ${i}: ${l.trim()}`);
  }
});
