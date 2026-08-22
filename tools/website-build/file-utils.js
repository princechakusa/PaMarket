'use strict';
const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..','..'); const DIST=path.join(ROOT,'dist-site');
function assertSafeDist(){const expected=path.join(ROOT,'dist-site');if(DIST!==expected||path.dirname(DIST)!==ROOT||path.basename(DIST)!=='dist-site')throw new Error('Refusing unsafe dist-site operation: '+DIST);}
function cleanDist(){assertSafeDist();fs.rmSync(DIST,{recursive:true,force:true});fs.mkdirSync(DIST,{recursive:true});}
function copyFile(relative){const source=path.join(ROOT,relative),target=path.join(DIST,relative);if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error('Allowlisted source file is missing: '+relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(path.extname(relative).toLowerCase()==='.html'){const{assembleHtml}=require('./shell');fs.writeFileSync(target,assembleHtml(fs.readFileSync(source,'utf8'),source),'utf8');}else fs.copyFileSync(source,target);}
function walkFiles(base,relative=''){if(!fs.existsSync(base))return[];const out=[];for(const entry of fs.readdirSync(path.join(base,relative),{withFileTypes:true})){const child=path.join(relative,entry.name);if(entry.isDirectory())out.push(...walkFiles(base,child));else if(entry.isFile())out.push(child.replace(/\\/g,'/'));}return out;}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
module.exports={ROOT,DIST,assertSafeDist,cleanDist,copyFile,walkFiles,sha256};
