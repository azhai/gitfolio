const fs = require('fs');
const code = fs.readFileSync('web/app-spa.js', 'utf8');
let stack = [];
let inString = false;
let stringChar = '';
for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (inString) {
        if (c === stringChar && code[i-1] !== '\\') inString = false;
        continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }
    if (c === '(') stack.push({char: '(', pos: i});
    if (c === ')') {
        if (stack.length === 0 || stack[stack.length-1].char !== '(') {
            console.log('Unmatched ) at pos', i);
            process.exit(1);
        }
        stack.pop();
    }
}
if (stack.length > 0) {
    console.log('Unclosed ( at:', stack[stack.length-1]);
    const line = code.substring(0, stack[stack.length-1].pos).split('\n').length;
    console.log('Line:', line);
} else {
    console.log('All parentheses matched');
}