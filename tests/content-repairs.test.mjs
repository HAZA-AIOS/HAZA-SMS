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
