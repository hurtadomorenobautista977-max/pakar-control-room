import fs from 'node:fs';import {build} from 'esbuild';
fs.mkdirSync('dist',{recursive:true});
const {outputFiles}=await build({entryPoints:['src/main.tsx'],bundle:true,write:false,minify:true,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'none'});
const css=fs.readFileSync('src/styles.css','utf8').replace(/^@import .*;$/gm,'');
const js=outputFiles[0].text.replaceAll('</script','<\\/script');
fs.writeFileSync('dist/index.html',`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>اتاق راهبری پاکار</title><meta name="description" content="فلوچارت ابزارها، گزارش وضعیت و بانک تصمیم‌های پاکار"><link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet"><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
fs.copyFileSync('dist/index.html','index.html');fs.writeFileSync('dist/.nojekyll','');fs.writeFileSync('.nojekyll','');console.log('Built',fs.statSync('index.html').size,'bytes');
