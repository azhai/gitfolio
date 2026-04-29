const fs = require('fs');
const content = fs.readFileSync('web/app-spa.js', 'utf8');

let stack = [];
let inString = false;
let stringChar = '';

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const prevChar = i > 0 ? content[i-1] : '';
    
    if (inString) {
        if (c === stringChar && prevChar !== '\\') {
            inString = false;
        }
        continue;
    }
    
    if (c === '"' || c === "'" || c === '`') {
        inString = true;
        stringChar = c;
        continue;
    }
    
    if (c === '(' || c === '[' || c === '{') {
        stack.push({char: c, pos: i});
    } else if (c === ')') {
        if (stack.length === 0 || stack[stack.length-1].char !== '(') {
            const lineNum = content.substring(0, i).split('\n').length;
            console.log(`Unmatched ')' at position ${i}, line ${lineNum}`);
            console.log('Expected:', stack.length > 0 ? stack[stack.length-1].char : 'nothing');
            process.exit(1);
        }
        stack.pop();
    } else if (c === ']') {
        if (stack.length === 0 || stack[stack.length-1].char !== '[') {
            const lineNum = content.substring(0, i).split('\n').length;
            console.log(`Unmatched ']' at position ${i}, line ${lineNum}`);
            process.exit(1);
        }
        stack.pop();
    } else if (c === '}') {
        if (stack.length === 0 || stack[stack.length-1].char !== '{') {
            const lineNum = content.substring(0, i).split('\n').length;
            console.log(`Unmatched '}' at position ${i}, line ${lineNum}`);
            process.exit(1);
        }
        stack.pop();
    }
}

if (stack.length > 0) {
    console.log('Unclosed brackets (' + stack.length + '):');
    stack.slice(-10).forEach(item => {
        const lineNum = content.substring(0, item.pos).split('\n').length;
        console.log(`${item.char} at line ${lineNum}, pos ${item.pos}`);
    });
} else {
    console.log('All brackets matched!');
}