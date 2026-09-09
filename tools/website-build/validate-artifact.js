'use strict';
const fs=require('fs');const path=require('path');const{DIST,walkFiles}=require('./file-utils');const{PROHIBITED_SEGMENTS,ROOT_PAGES,ROOT_FILES,GENERATED_ROUTE_DIRS}=require('./config');
const SECRET_PATTERNS=[/SUPABASE_SERVICE_ROLE/i,/service[_-]?role.{0,30}(key|secret)/i,/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/\bsk_live_[A-Za-z0-9]+/];
function validateArtifact(){const errors=[],warnings=[],files=walkFiles(DIST);for(const relative of files){const segments=relative.split('/');if(segments.some(x=>PROHIBITED_SEGMENTS.has(x)))errors.push('Prohibited path: '+relative);if(/\.map$/i.test(relative)||/(^|\/)\.env(?:\.|$)/i.test(relative))errors.push('Prohibited file: '+relative);const absolute=path.join(DIST,relative);if(fs.statSync(absolute).size<=2*1024*1024){const content=fs.readFileSync(absolute,'utf8');if(SECRET_PATTERNS.some(p=>p.test(content)))errors.push('Potential privileged credential: '+relative);}}
for(const required of [...ROOT_PAGES,...ROOT_FILES])if(!fs.existsSync(path.join(DIST,required)))errors.push('Missing public file: '+required);if(fs.existsSync(path.join(DIST,'www')))errors.push('dist-site/www must never exist');
// A generated route directory can legitimately be empty (e.g. zero
// currently-active rental listings) — that's a business state, not a
// broken build, and git can't even track an empty directory anyway, so it
// vanishes from every fresh checkout regardless. A hard error here would
// block the ENTIRE site's deploy over one vertical having no live items
// right now. Warn instead so it's visible without blocking.
for(const dir of GENERATED_ROUTE_DIRS)if(!walkFiles(path.join(DIST,dir)).some(x=>x.endsWith('.html')))warnings.push('Generated route directory is empty: '+dir+' (0 current items, or the directory does not exist in this checkout)');
if(errors.length)throw new Error(errors.join('\n'));return{files:files.length,prohibited:0,secretFindings:0,warnings:warnings};}
if(require.main===module)console.log(JSON.stringify(validateArtifact(),null,2));module.exports={validateArtifact};
