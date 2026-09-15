import { env } from "cloudflare:workers";
import { safeMetadata } from "./security";

const PROBE_TIMEOUT_MS = 5000;
const AUTO_INCIDENT_TITLE = "Automated service alert";
const DEFAULT_DATABASE_BUDGET_BYTES = 512 * 1024 * 1024;
const DEFAULT_STORAGE_BUDGET_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_CAPACITY_WARNING_PERCENT = 80;

export type AutomationPolicy = {
  id:string;
  organization_id:string;
  enabled:number;
  interval_minutes:number;
  failure_threshold:number;
  notify_recovery:number;
  updated_by:string;
  last_evaluated_at:number|null;
  last_result:string|null;
};

export type MonitoringSettings = {
  database_budget_bytes:number;
  storage_budget_bytes:number;
  capacity_warning_percent:number;
  slow_request_threshold_ms:number;
};

export type CapacityReading = MonitoringSettings & {
  databaseLogicalBytes:number|null;
  storageBytes:number;
  storageObjectCount:number;
  databasePercent:number|null;
  storagePercent:number;
  measuredAt:number;
};

async function probe(check:()=>Promise<boolean>){
  const started=Date.now();let timer:ReturnType<typeof setTimeout>|undefined;
  try{const ready=await Promise.race([Promise.resolve().then(check).catch(()=>false),new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),PROBE_TIMEOUT_MS)})]);return{ready,latencyMs:Date.now()-started};}
  finally{clearTimeout(timer)}
}

async function notificationStatements(organizationId:string,eventCode:string,title:string,body:string,entityId:string){
  const recipients=await env.DB.prepare("SELECT DISTINCT om.user_id FROM organization_memberships om JOIN membership_roles mr ON mr.membership_id=om.id JOIN role_permissions rp ON rp.role_id=mr.role_id JOIN permissions p ON p.id=rp.permission_id WHERE om.organization_id=?1 AND om.status='active' AND p.code='monitoring.view' LIMIT 100").bind(organizationId).all<{user_id:string}>();
  return recipients.results.map(recipient=>env.DB.prepare("INSERT INTO user_notifications (id,organization_id,user_id,event_code,title,body,entity_type,entity_id) VALUES (?1,?2,?3,?4,?5,?6,'monitoring_incident',?7)").bind(crypto.randomUUID(),organizationId,recipient.user_id,eventCode,title,body,entityId));
}

export async function readMonitoringSettings(organizationId:string):Promise<MonitoringSettings>{
  const row=await env.DB.prepare("SELECT database_budget_bytes,storage_budget_bytes,capacity_warning_percent,slow_request_threshold_ms FROM operational_monitoring_settings WHERE organization_id=?1").bind(organizationId).first<MonitoringSettings>();
  return row??{database_budget_bytes:DEFAULT_DATABASE_BUDGET_BYTES,storage_budget_bytes:DEFAULT_STORAGE_BUDGET_BYTES,capacity_warning_percent:DEFAULT_CAPACITY_WARNING_PERCENT,slow_request_threshold_ms:1000};
}

export async function readCapacity(organizationId:string):Promise<CapacityReading>{
  const [settings,backup,assets,receipts,backups]=await Promise.all([
    readMonitoringSettings(organizationId),
    env.DB.prepare("SELECT size_bytes FROM backup_runs WHERE organization_id=?1 AND status='completed' AND size_bytes IS NOT NULL ORDER BY completed_at DESC LIMIT 1").bind(organizationId).first<{size_bytes:number}>(),
    env.DB.prepare("SELECT coalesce(sum(size_bytes),0) bytes,count(*) objects FROM storage_assets WHERE organization_id=?1").bind(organizationId).first<{bytes:number;objects:number}>(),
    env.DB.prepare("SELECT coalesce(sum(receipt_size_bytes),0) bytes,count(*) objects FROM subscription_payments WHERE organization_id=?1").bind(organizationId).first<{bytes:number;objects:number}>(),
    env.DB.prepare("SELECT coalesce(sum(size_bytes),0) bytes,count(*) objects FROM backup_runs WHERE organization_id=?1 AND status='completed' AND r2_key IS NOT NULL").bind(organizationId).first<{bytes:number;objects:number}>(),
  ]);
  const databaseLogicalBytes=backup?.size_bytes??null,storageBytes=(assets?.bytes??0)+(receipts?.bytes??0)+(backups?.bytes??0),storageObjectCount=(assets?.objects??0)+(receipts?.objects??0)+(backups?.objects??0);
  return{...settings,databaseLogicalBytes,storageBytes,storageObjectCount,databasePercent:databaseLogicalBytes===null?null:Math.round(databaseLogicalBytes/settings.database_budget_bytes*1000)/10,storagePercent:Math.round(storageBytes/settings.storage_budget_bytes*1000)/10,measuredAt:Date.now()};
}

async function reconcileCapacityIncident(organizationId:string,operatorUserId:string,capacity:CapacityReading){
  const databaseWarning=capacity.databasePercent!==null&&capacity.databasePercent>=capacity.capacity_warning_percent,storageWarning=capacity.storagePercent>=capacity.capacity_warning_percent;
  const existing=await env.DB.prepare("SELECT id FROM monitoring_incidents WHERE organization_id=?1 AND source='capacity' AND status!='resolved' LIMIT 1").bind(organizationId).first<{id:string}>();
  if((databaseWarning||storageWarning)&&!existing){
    const id=crypto.randomUUID(),message=`D1 logical data: ${capacity.databasePercent??"not measured"}%; tracked R2 storage: ${capacity.storagePercent}%; warning threshold: ${capacity.capacity_warning_percent}%.`,notifications=await notificationStatements(organizationId,"monitoring.capacity.warning","Capacity budget warning",message,id);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO monitoring_incidents (id,organization_id,source,severity,status,title,description,created_by) VALUES (?1,?2,'capacity','high','open','Capacity budget warning',?3,?4)").bind(id,organizationId,message,operatorUserId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'monitoring.capacity.warning','monitoring_incident',?4,'success',?5)").bind(crypto.randomUUID(),organizationId,operatorUserId,id,safeMetadata({databasePercent:capacity.databasePercent,storagePercent:capacity.storagePercent,warningPercent:capacity.capacity_warning_percent})),
      ...notifications,
    ]);
  }else if(!databaseWarning&&!storageWarning&&existing){
    const notifications=await notificationStatements(organizationId,"monitoring.capacity.recovered","Capacity returned below warning level","D1 and tracked R2 consumption are below the configured warning threshold.",existing.id);
    await env.DB.batch([
      env.DB.prepare("UPDATE monitoring_incidents SET status='resolved',resolved_by=?1,resolved_at=unixepoch()*1000,resolution_note='Automatically resolved after capacity returned below the warning threshold.',updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(operatorUserId,existing.id,organizationId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'monitoring.capacity.recovered','monitoring_incident',?4,'success')").bind(crypto.randomUUID(),organizationId,operatorUserId,existing.id),
      ...notifications,
    ]);
  }
}

export async function runOperationalCheck({organizationId,operatorUserId,triggerType,failureThreshold=1,notifyRecovery=true}:{organizationId:string;operatorUserId:string;triggerType:"manual"|"scheduled";failureThreshold?:number;notifyRecovery?:boolean}){
  const [database,storage,capacity]=await Promise.all([
    probe(async()=>(await env.DB.prepare("SELECT 1 AS ready").first<{ready:number}>())?.ready===1),
    probe(async()=>{await env.BUCKET.head("__health_probe__");return true}),
    readCapacity(organizationId),
  ]);
  const status=database.ready&&storage.ready?"ready":"degraded",id=crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO operational_check_runs (id,organization_id,status,application_status,database_status,storage_status,database_latency_ms,storage_latency_ms,trigger_type,triggered_by,details_json) VALUES (?1,?2,?3,'ready',?4,?5,?6,?7,?8,?9,?10)").bind(id,organizationId,status,database.ready?"ready":"unavailable",storage.ready?"ready":"unavailable",database.latencyMs,storage.latencyMs,triggerType,operatorUserId,safeMetadata({probeTimeoutMs:PROBE_TIMEOUT_MS})),
    env.DB.prepare("INSERT INTO capacity_snapshots (id,organization_id,database_logical_bytes,storage_bytes,storage_object_count,database_budget_bytes,storage_budget_bytes,warning_percent,triggered_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(crypto.randomUUID(),organizationId,capacity.databaseLogicalBytes,capacity.storageBytes,capacity.storageObjectCount,capacity.database_budget_bytes,capacity.storage_budget_bytes,capacity.capacity_warning_percent,operatorUserId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'operational_check_run',?5,?6,?7)").bind(crypto.randomUUID(),organizationId,operatorUserId,triggerType==="scheduled"?"monitoring.check.scheduled":"monitoring.check.run",id,status==="ready"?"success":"failed",safeMetadata({database:database.ready,storage:storage.ready})),
  ]);
  await reconcileCapacityIncident(organizationId,operatorUserId,capacity);

  const incidentSource=triggerType==="scheduled"?"automation":"platform",incidentTitle=triggerType==="scheduled"?AUTO_INCIDENT_TITLE:"Production service check degraded";
  const existing=await env.DB.prepare("SELECT id FROM monitoring_incidents WHERE organization_id=?1 AND source=?2 AND status!='resolved' LIMIT 1").bind(organizationId,incidentSource).first<{id:string}>();
  if(status==="ready"&&triggerType==="scheduled"&&existing&&notifyRecovery){
    const notifications=await notificationStatements(organizationId,"monitoring.service.recovered","Production services recovered","The automated service check reports that database and file storage are ready.",existing.id);
    await env.DB.batch([
      env.DB.prepare("UPDATE monitoring_incidents SET status='resolved',resolved_by=?1,resolved_at=unixepoch()*1000,resolution_note='Automatically resolved after a successful service check.',updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(operatorUserId,existing.id,organizationId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'monitoring.incident.auto_resolve','monitoring_incident',?4,'success')").bind(crypto.randomUUID(),organizationId,operatorUserId,existing.id),
      ...notifications,
    ]);
  }
  if(status==="degraded"&&!existing){
    let open=triggerType==="manual";
    if(!open){const recent=await env.DB.prepare("SELECT status FROM operational_check_runs WHERE organization_id=?1 AND trigger_type='scheduled' ORDER BY created_at DESC LIMIT ?2").bind(organizationId,failureThreshold).all<{status:string}>();open=recent.results.length>=failureThreshold&&recent.results.every(item=>item.status==="degraded");}
    if(open){const incidentId=crypto.randomUUID(),message=`Database: ${database.ready?"ready":"unavailable"}; storage: ${storage.ready?"ready":"unavailable"}.`;
      const notifications=await notificationStatements(organizationId,"monitoring.service.degraded","Production service alert",message,incidentId);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO monitoring_incidents (id,organization_id,source,severity,status,title,description,created_by) VALUES (?1,?2,?3,'critical','open',?4,?5,?6)").bind(incidentId,organizationId,incidentSource,incidentTitle,message,operatorUserId),
        env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'monitoring.alert.open','monitoring_incident',?4,'success',?5)").bind(crypto.randomUUID(),organizationId,operatorUserId,incidentId,safeMetadata({triggerType,failureThreshold})),
        ...notifications,
      ]);
    }
  }
  return{id,status,database,storage,capacity};
}

export async function evaluateOperationalAutomation(organizationId:string){
  const policy=await env.DB.prepare("SELECT * FROM operational_automation_policies WHERE organization_id=?1 AND enabled=1").bind(organizationId).first<AutomationPolicy>();
  if(!policy)return{ran:false,status:null};
  const now=Date.now(),dueBefore=now-policy.interval_minutes*60000;
  const claim=await env.DB.prepare("UPDATE operational_automation_policies SET last_evaluated_at=?1,updated_at=unixepoch()*1000 WHERE organization_id=?2 AND enabled=1 AND (last_evaluated_at IS NULL OR last_evaluated_at<=?3)").bind(now,organizationId,dueBefore).run();
  if((claim.meta.changes??0)<1)return{ran:false,status:policy.last_result};
  const result=await runOperationalCheck({organizationId,operatorUserId:policy.updated_by,triggerType:"scheduled",failureThreshold:policy.failure_threshold,notifyRecovery:Boolean(policy.notify_recovery)});
  await env.DB.prepare("UPDATE operational_automation_policies SET last_result=?1 WHERE organization_id=?2").bind(result.status,organizationId).run();
  return{ran:true,status:result.status};
}
