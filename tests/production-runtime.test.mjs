import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const url = source => 'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64');

test('health preserves independent service results and contains failures',async()=>{
 globalThis.__healthEnv={DB:{prepare:()=>({first:async()=>({ready:1})})},BUCKET:{head:async()=>null}};
 const api=await import(url(read('app/api/health/route.ts').replace('import { env } from "cloudflare:workers";','const env=globalThis.__healthEnv;')));
 let response=await api.GET();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 globalThis.__healthEnv.DB.prepare=()=>({first:async()=>{throw Error('private database details')}});
 response=await api.GET();assert.equal(response.status,503);let data=await response.json();assert.deepEqual(data.checks,{application:true,database:false,storage:true});assert.ok(!JSON.stringify(data).includes('private'));
 globalThis.__healthEnv.DB.prepare=()=>({first:async()=>({ready:1})});
 globalThis.__healthEnv.BUCKET.head=async()=>{throw Error('storage failure')};
 data=await (await api.GET()).json();assert.deepEqual(data.checks,{application:true,database:true,storage:false});
 globalThis.__healthEnv.BUCKET.head=()=>new Promise(()=>{});
 const started=Date.now();response=await api.GET();assert.equal(response.status,503);assert.ok(Date.now()-started<6500,'A hanging probe must return within the timeout budget');
});

test('backup snapshots cover current school tables, isolate tenants, and verify stored bytes metadata',async()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(read('drizzle/'+file));
 db.exec("INSERT INTO organizations(id,name,slug) VALUES('org','School','school'),('other','Other','other'); INSERT INTO users(id,display_name,email) VALUES('editor','Editor','editor@example.invalid'); INSERT INTO number_sequences(id,organization_id,sequence_type,next_value) VALUES('seq','org','invoice',27),('foreign-seq','other','invoice',999)");
 let stored, metadata, storageFails=false, authorized=true;
 const prepare=sql=>{let values=[];return {bind(...args){values=args;return this},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return db.prepare(sql).run(...values)}}};
 globalThis.__backupEnv={DB:{prepare,async batch(statements){return Promise.all(statements.map(s=>s.run()))}},BUCKET:{async put(key,body,options){stored=body;metadata=options.customMetadata;assert.ok(key.startsWith('organizations/org/backups/'));},async head(){return storageFails?null:{size:Buffer.byteLength(stored),customMetadata:metadata}}}};
 globalThis.__backupAuth=async()=>authorized?{organizationId:'org',userId:'editor'}:null;
 const source=read('app/api/security/backups/route.ts').replace('import { env } from "cloudflare:workers";','const env=globalThis.__backupEnv;').replace(/import \{ authorize \} from "[^"]+";/,'const authorize=globalThis.__backupAuth;').replace(/import \{ enforceRateLimit, requireSameOrigin \} from "[^"]+";/,'const enforceRateLimit=async()=>true;const requireSameOrigin=()=>null;');
 const api=await import(url(source));const request=()=>new Request('https://school.test/api/security/backups',{method:'POST'});
 let response=await api.POST(request());assert.equal(response.status,200,await response.clone().text());
 const snapshot=JSON.parse(stored);assert.equal(snapshot.manifest.version,2);assert.equal(snapshot.manifest.fileBytesIncluded,false);assert.equal(snapshot.tables.number_sequences[0].next_value,27);assert.equal(snapshot.tables.number_sequences.length,1);assert.equal(snapshot.tables.organizations.length,1);
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()){
  const scoped=db.prepare(`PRAGMA table_info(${name})`).all().some(c=>c.name==='organization_id');
  if(scoped&&!['backup_runs','rate_limits'].includes(name))assert.ok(snapshot.manifest.tables.includes(name),`Missing table: ${name}`);
 }
 for(const table of ['campus_memberships','membership_roles','role_permissions','student_guardians','assignment_resources'])assert.ok(snapshot.manifest.tables.includes(table));
 assert.equal(metadata.sha256,createHash('sha256').update(stored).digest('hex'));
 assert.equal(db.prepare("SELECT status FROM backup_runs ORDER BY rowid DESC LIMIT 1").get().status,'completed');
 storageFails=true;response=await api.POST(request());assert.equal(response.status,500);assert.equal(db.prepare("SELECT status FROM backup_runs ORDER BY rowid DESC LIMIT 1").get().status,'failed');
 authorized=false;response=await api.POST(request());assert.equal(response.status,403);assert.equal(db.prepare('SELECT count(*) n FROM backup_runs').get().n,2);
 db.close();
});
