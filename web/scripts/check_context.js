const fs = require('fs');
const content = fs.readFileSync('web/app-spa.js', 'utf8');
const lines = content.split('\n');
console.log('Lines around more-members (7763-7770):');
for (let i = 7762; i < 7770 && i < lines.length; i++) {
    console.log(`Line ${i+1}: ${JSON.stringify(lines[i])}`);
}