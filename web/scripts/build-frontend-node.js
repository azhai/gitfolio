const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'web', 'src');
const outputFile = path.join(__dirname, 'web', 'app-spa.js');

console.log('Building GitFolio frontend...');

let output = `// GitFolio Frontend Build - ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n`;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/^import\s+.*$/gm, '');
    content = content.replace(/^export\s+.*$/gm, '');
    return content;
}

console.log('Adding shared constants and utilities...');
output += processFile(path.join(srcDir, 'shared.js'));

console.log('Adding API and Auth...');
let apiContent = processFile(path.join(srcDir, 'api.js'));
output += apiContent.replace(/return request\(/g, 'return m.request(');

console.log('Adding components...');
output += processFile(path.join(srcDir, 'components.js'));

console.log('Adding modals...');
output += processFile(path.join(srcDir, 'modals.js'));

console.log('Adding project modals...');
output += processFile(path.join(srcDir, 'project-modals.js'));

const pages = [
    'dashboard', 'projects', 'project-detail', 'issues', 'issue-detail',
    'new-issue', 'pull-requests', 'pr-detail', 'new-pr', 'tasks',
    'task-detail', 'new-task', 'releases-stats', 'settings',
    'create-project', 'migrate-project', 'login', 'groups',
    'activities', 'milestones', 'snippets', 'commits', 'user-management'
];

console.log('Adding pages...');
for (const file of pages) {
    console.log(`Processing ${file}.js...`);
    output += processFile(path.join(srcDir, 'pages', `${file}.js`));
}

console.log('Adding app initialization...');
output += processFile(path.join(srcDir, 'app.js'));

fs.writeFileSync(outputFile, output);
console.log('Frontend build complete!');
console.log(`Output: ${outputFile}`);