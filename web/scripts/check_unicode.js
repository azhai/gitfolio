const fs = require('fs');
let code = fs.readFileSync('web/app-spa.js', 'utf8');
for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    if ((c >= 0x200B && c <= 0x200F) || 
        (c >= 0x2028 && c <= 0x2029) || 
        c === 0xFEFF ||
        (c >= 0x2060 && c <= 0x2063)) {
        console.log('Suspicious Unicode at pos', i, ':', '0x' + c.toString(16));
        const line = code.substring(0, i).split('\n').length;
        console.log('Line:', line);
    }
}