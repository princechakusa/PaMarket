'use strict';
const fs=require('fs');const path=require('path');const{DIST,walkFiles,sha256}=require('./file-utils');
function createArtifactManifest(){const name='artifact-manifest.json';const files=walkFiles(DIST).filter(x=>x!==name).sort().map(relative=>{const absolute=path.join(DIST,relative);return{path:relative,bytes:fs.statSync(absolute).size,sha256:sha256(absolute)};});const manifest={version:1,algorithm:'sha256',files};fs.writeFileSync(path.join(DIST,name),JSON.stringify(manifest,null,2)+'\n');return manifest;}
if(require.main===module)console.log(JSON.stringify(createArtifactManifest(),null,2));module.exports={createArtifactManifest};
