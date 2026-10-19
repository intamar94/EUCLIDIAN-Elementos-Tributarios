import {readdir, mkdir, rm, copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const target=path.join(root,'dist-cloudflare/public');
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
// Explicit public extensions, never copy source folders, SQL, docs or configuration.
const rootAllowed=/\.(html|css|js|png|svg|ico|webp)$/;
const mediaAllowed=/\.(png|svg|ico|webp|jpg|jpeg|gif|webm|mp4|woff2?)$/;
let count=0;
async function copyMedia(src,dst){
  await mkdir(dst,{recursive:true});
  for(const entry of await readdir(src,{withFileTypes:true})){
    if(entry.name.startsWith('.'))continue;
    const from=path.join(src,entry.name),to=path.join(dst,entry.name);
    if(entry.isDirectory())await copyMedia(from,to);
    else if(entry.isFile()&&mediaAllowed.test(entry.name)){await copyFile(from,to);count++;}
  }
}
for(const entry of await readdir(root,{withFileTypes:true})){
  if(entry.isFile()&&(rootAllowed.test(entry.name)||['robots.txt','sitemap.xml'].includes(entry.name))){
    await copyFile(path.join(root,entry.name),path.join(target,entry.name));count++;
  }
}
await copyMedia(path.join(root,'assets'),path.join(target,'assets'));
console.log(`Cloudflare: ${count} archivos públicos preparados.`);
