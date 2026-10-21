const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build', '.gemini'].includes(entry.name)) {
        searchDir(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('MP-') || content.includes('`MP') || content.includes("'MP'")) {
        console.log('Match in:', fullPath);
        const lines = content.split('\n');
        lines.forEach((l, idx) => {
          if (l.includes('MP-') || l.includes('`MP') || l.includes("'MP'") || l.includes('"MP"')) {
            console.log(`  L${idx + 1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

searchDir('e:/MANUFACTURING_ERP/apps');
