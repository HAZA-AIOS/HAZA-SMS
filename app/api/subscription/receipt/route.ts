import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { getOrganizationSubscription, isPaidPlan, PLAN_PRICES, subscriptionAllowsDashboard } from "../../../../lib/subscriptions";
import { requireSameOrigin } from "../../../../lib/security";

export const dynamic="force-dynamic";
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","application/pdf"]), methods=new Set(["bank","jazzcash","easypaisa"]);
function clean(value:FormDataEntryValue|null,max:number){return typeof value==="string"?value.trim().slice(0,max):"";}
function safeName(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100)||"receipt";}
export async function POST(request:Request){
  const origin=requireSameOrigin(request); if(origin)return origin;
  const auth=await authorize(undefined,{allowInactiveSubscription:true}); if(!auth)return Response.json({error:"School access is required."},{status:403});
  const form=await request.formData().catch(()=>null); if(!form)return Response.json({error:"Invalid receipt form."},{status:400});
  const plan=clean(form.get("plan"),20),method=clean(form.get("paymentMethod"),20),reference=clean(form.get("paymentReference"),120),payer=clean(form.get("payerName"),100),receipt=form.get("receipt");
  if(!isPaidPlan(plan)||!methods.has(method)||reference.length<3||payer.length<2||!(receipt instanceof File)||receipt.size<1||receipt.size>8*1024*1024||!allowedTypes.has(receipt.type))return Response.json({error:"Complete the payment details and upload a JPEG, PNG, WebP or PDF receipt up to 8 MB."},{status:400});
  const subscription=await getOrganizationSubscription(auth.organizationId); if(!subscription)return Response.json({error:"Subscription record is missing."},{status:409});
  const existing=await env.DB.prepare("SELECT id FROM subscription_payments WHERE organization_id=?1 AND status='pending' LIMIT 1").bind(auth.organizationId).first(); if(existing)return Response.json({error:"A payment receipt is already pending review."},{status:409});
  const id=crypto.randomUUID(),key=`subscriptions/${auth.organizationId}/${id}-${safeName(receipt.name)}`;
  await env.BUCKET.put(key,await receipt.arrayBuffer(),{httpMetadata:{contentType:receipt.type},customMetadata:{organizationId:auth.organizationId,paymentId:id}});
  try{await env.DB.batch([
    env.DB.prepare("INSERT INTO subscription_payments (id,organization_id,subscription_id,plan,amount_pkr,payment_method,payment_reference,payer_name,receipt_r2_key,receipt_name,receipt_content_type,receipt_size_bytes,status,submitted_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'pending',?13)").bind(id,auth.organizationId,subscription.id,plan,PLAN_PRICES[plan],method,reference,payer,key,receipt.name,receipt.type,receipt.size,auth.userId),
    env.DB.prepare("UPDATE organization_subscriptions SET status=?1,updated_at=unixepoch()*1000 WHERE id=?2").bind(subscriptionAllowsDashboard(subscription)?subscription.status:"pending_review",subscription.id),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'subscription.receipt.submit','subscription_payment',?4,'success',?5)").bind(crypto.randomUUID(),auth.organizationId,auth.userId,id,JSON.stringify({plan,method,amountPkr:PLAN_PRICES[plan]})),
  ]);return Response.json({ok:true});}catch(error){await env.BUCKET.delete(key).catch(()=>{});console.error("subscription_receipt_failed",error);return Response.json({error:"Receipt could not be saved."},{status:500});}
}
