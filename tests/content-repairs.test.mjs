import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(s,{mode:'transform'})).toString('base64');
test('multipart uploads validate actual bytes without requiring a length header',async()=>{
 let saved;const metadata={uploadId:'upload',organizationId:'org',campusId:null,totalParts:1,size:4};
 globalThis.__repairEnv={BUCKET:{get:async()=>({json:async()=>metadata}),resumeMultipartUpload:()=>({uploadPart:async(n,bytes)=>{saved=bytes;return {partNumber:n,etag:'etag'}}})}};
 const env=s=>s.replace('import { env } from "cloudflare:workers";','const env=globalThis.__repairEnv;');
 const helper=moduleURL(env(read('lib/public-forms.ts')));
 const source=env(read('app/api/public-content/downloads/multipart/route.ts')).replace(/import \{ authorize, canAccessCampus \} from "[^"]+";/,'const authorize=async()=>({organizationId:"org"});const canAccessCampus=()=>false;').replace(/import \{ enforceRateLimit, requireSameOrigin \} from "[^"]+";/,'const requireSameOrigin=()=>null;const enforceRateLimit=async()=>true;').replace(/from "[^"]+lib\/public-forms"/,`from "${helper}"`);
 const api=await import(moduleURL(source));const req=body=>new Request('https://test/api?uploadId=upload&key=organizations/org/public-downloads/file&partNumber=1',{method:'PUT',body});
 const good=req(new Uint8Array([1,2,3,4]));assert.equal(good.headers.get('content-length'),null);assert.equal((await api.PUT(good)).status,200);assert.equal(saved.byteLength,4);
 assert.equal((await api.PUT(req(new Uint8Array([1,2])))).status,400);
 assert.equal((await api.PUT(req(new Uint8Array(5)))).status,413);
 metadata.campusId='denied';assert.equal((await api.PUT(req(new Uint8Array(4)))).status,403);
});
test('news corrections update the same record and reject another organization',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE public_news_events(id TEXT PRIMARY KEY,organization_id TEXT,campus_id TEXT,kind TEXT,title TEXT,summary TEXT,event_starts_at INTEGER,location TEXT); INSERT INTO public_news_events VALUES('item','org',NULL,'news','Old title','Original',NULL,NULL)");
 globalThis.__newsEnv={DB:{prepare(sql){let args;return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)},async run(){return db.prepare(sql).run(...args)}}}}};
 let org='org';globalThis.__newsAuth=async()=>({organizationId:org,userId:'editor'});
 const source=read('app/api/public-content/news-events/route.ts').replace('import { env } from "cloudflare:workers";','const env=globalThis.__newsEnv;').replace(/import \{ authorize, canAccessCampus \} from "[^"]+";/,'const authorize=globalThis.__newsAuth;const canAccessCampus=()=>true;').replace(/import \{ requireSameOrigin \} from "[^"]+";/,'const requireSameOrigin=()=>null;');
 const api=await import(moduleURL(source));const req=()=>new Request('https://test/api',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:'item',kind:'event',title:'Correct title',summary:'Correct details',eventStartsAt:'2026-09-10T10:00:00Z',location:'Main Campus'})});
 assert.equal((await api.PATCH(req())).status,200);assert.equal(db.prepare('SELECT title FROM public_news_events').get().title,'Correct title');assert.equal(db.prepare('SELECT count(*) n FROM public_news_events').get().n,1);
 org='other';assert.equal((await api.PATCH(req())).status,404);db.close();
});
test('complete multipart lifecycle preserves long opaque provider IDs and publishes exact bytes',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {readdirSync}=await import('node:fs');const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(read('drizzle/'+file));
 db.exec("INSERT INTO organizations(id,name,slug) VALUES('org','The Mentor School','mentor'); INSERT INTO users(id,display_name,email) VALUES('editor','Editor','editor@example.invalid')");
 const objects=new Map(),parts=new Map();const providerId='opaque/'.repeat(150)+'+=';
 globalThis.__lifecycleEnv={DB:{prepare(sql){let args;return {bind(...v){args=v;return this},async run(){return db.prepare(sql).run(...args)}}},async batch(statements){db.exec('BEGIN');try{for(const s of statements)await s.run();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}},BUCKET:{async createMultipartUpload(){return {uploadId:providerId}},async put(key,value){objects.set(key,value)},async get(key){return objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null},async head(key){return objects.has(key)?{size:objects.get(key).byteLength}:null},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key)},resumeMultipartUpload(key,id){assert.equal(id,providerId);return {async uploadPart(n,bytes){parts.set(n,bytes);return {partNumber:n,etag:'etag-'+n}},async complete(list){assert.deepEqual(list.map(v=>v.partNumber),[1,2]);const out=new Uint8Array([...parts.values()].reduce((n,v)=>n+v.length,0));let offset=0;for(const v of parts.values()){out.set(v,offset);offset+=v.length}objects.set(key,out)},async abort(){parts.clear()}}}}};
 const source=read('app/api/public-content/downloads/multipart/route.ts').replace('import { env } from "cloudflare:workers";','const env=globalThis.__lifecycleEnv;').replace(/import \{ authorize, canAccessCampus \} from "[^"]+";/,'const authorize=async()=>({organizationId:"org",userId:"editor"});const canAccessCampus=()=>true;').replace(/import \{ enforceRateLimit, requireSameOrigin \} from "[^"]+";/,'const requireSameOrigin=()=>null;const enforceRateLimit=async()=>true;');
 const helper=moduleURL(read('lib/public-forms.ts').replace('import { env } from "cloudflare:workers";','const env=globalThis.__lifecycleEnv;'));
 const api=await import(moduleURL(source.replace(/from "[^"]+lib\/public-forms"/,`from "${helper}"`)));
 const post=body=>new Request('https://test/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const size=10*1024*1024+24;let response=await api.POST(post({action:'initiate',title:'Prospectus',category:'Books',fileName:'prospectus.pdf',contentType:'application/pdf',size}));assert.equal(response.status,200);
 const session=await response.json();assert.equal(session.uploadId.length,36);assert.notEqual(session.uploadId,providerId);
 const uploaded=[];for(const [index,length] of [10*1024*1024,24].entries()){const body=new Uint8Array(length).fill(index+1);response=await api.PUT(new Request('https://test/api?'+new URLSearchParams({...session,partNumber:String(index+1)}),{method:'PUT',body}));assert.equal(response.status,200,await response.clone().text());uploaded.push(await response.json())}
 response=await api.POST(post({action:'complete',...session,parts:uploaded}));assert.equal(response.status,200,await response.clone().text());
 const row=db.prepare('SELECT d.title,d.category,d.status,a.size_bytes,a.r2_key FROM public_downloads d JOIN storage_assets a ON a.id=d.asset_id').get();assert.equal(row.status,'published');assert.equal(row.category,'Books');assert.equal(row.size_bytes,size);assert.equal(objects.get(row.r2_key)[size-1],2);assert.equal(objects.size,1);db.close();
});
test('public downloads serve exact PDF ranges and reject invalid ranges',async()=>{
 const bytes=new Uint8Array([0,1,2,3,4,5,6,7,8,9]);let published=true;
 globalThis.__rangeEnv={DB:{prepare(){return {bind(){return this},async first(){return published?{r2_key:'pdf',original_name:'book.pdf',content_type:'application/pdf'}:null}}}},BUCKET:{async head(){return {size:bytes.length}},async get(key,options){const r=options?.range;return {body:r?bytes.slice(r.offset,r.offset+r.length):bytes}}}};
 const api=await import(moduleURL(read('app/api/public-downloads/[id]/route.ts').replace('import { env } from "cloudflare:workers";','const env=globalThis.__rangeEnv;')));
 const get=range=>api.GET(new Request('https://test/api/public-downloads/book?preview=1',{headers:range?{range}:{}}),{params:Promise.resolve({id:'book'})});
 for(const [range,expected] of [['bytes=2-5',[2,3,4,5]],['bytes=-3',[7,8,9]],['bytes=8-',[8,9]]]){const r=await get(range);assert.equal(r.status,206);assert.equal(r.headers.get('content-length'),String(expected.length));assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],expected)}
 for(const range of ['bytes=20-','bytes=5-2','bytes=-0','bytes=','bytes=0-1,3-4'])assert.equal((await get(range)).status,416);
 const full=await get();assert.equal(full.status,200);assert.equal(full.headers.get('accept-ranges'),'bytes');assert.equal((await full.arrayBuffer()).byteLength,10);
 published=false;assert.equal((await get('bytes=0-1')).status,404);
});
