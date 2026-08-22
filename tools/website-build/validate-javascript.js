'use strict';
const path=require('path');const{execFileSync}=require('child_process');const{DIST,walkFiles}=require('./file-utils');
function validateJavaScript(){const files=walkFiles(DIST).filter(x=>x.endsWith('.js')).sort();for(const relative of files)execFileSync(process.execPath,['--check',path.join(DIST,relative)],{stdio:'pipe'});return{checked:files.length,files};}
if(require.main===module)console.log(JSON.stringify(validateJavaScript(),null,2));module.exports={validateJavaScript};
