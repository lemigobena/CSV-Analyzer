const fs = require('fs');
const out = fs.createWriteStream('backend/large-test.csv');
out.write('Department Name,Date,Number of Sales\n');
const depts = ['Electronics', 'Clothing', 'Home', 'Books', 'Toys'];
for (let i = 0; i < 100000; i++) {
    out.write(`${depts[Math.floor(Math.random() * depts.length)]},2023-01-01,${Math.floor(Math.random() * 1000)}\n`);
}
out.end();
console.log('Generated');
