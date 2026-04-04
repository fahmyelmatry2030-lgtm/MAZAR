const fs = require('fs');

const mazar1Files = fs.readdirSync('./public/images/Mazar 1 Pictures')
  .filter(f => !f.startsWith('.'))
  .map(f => '/images/Mazar%201%20Pictures/' + encodeURIComponent(f).replace(/'/g, "%27"));

const mazar2Files = fs.readdirSync('./public/images/Mazar 2 Pictures')
  .filter(f => !f.startsWith('.'))
  .map(f => '/images/Mazar%202%20Pictures/' + encodeURIComponent(f).replace(/'/g, "%27"));

let dataTs = fs.readFileSync('./src/lib/data.ts', 'utf8');

const regexArrays = /const mazar1Images = \[[\s\S]*?\];\s*const mazar2Images = \[[\s\S]*?\];/m;

const newArrays = `const mazar1Images = ${JSON.stringify(mazar1Files, null, 2)};\nconst mazar2Images = ${JSON.stringify(mazar2Files, null, 2)};`;

dataTs = dataTs.replace(regexArrays, newArrays);

// Also change the logic to distribute images
dataTs = dataTs.replace(/images: mazar1Images,/g, 'images: mazar1Images.slice((i * 4) % mazar1Images.length, (i * 4) % mazar1Images.length + 5),');
dataTs = dataTs.replace(/images: mazar2Images,/g, 'images: mazar2Images.slice((i * 5) % mazar2Images.length, (i * 5) % mazar2Images.length + 5),');

fs.writeFileSync('./src/lib/data.ts', dataTs);
console.log('Updated data.ts successfully');
