import { authorize } from "../../../../lib/authorization";
import { evaluateOperationalAutomation } from "../../../../lib/monitoring";
import { requireSameOrigin } from "../../../../lib/security";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("monitoring.view");
  if(!auth||!auth.organizationWide)return Response.json({error:"Monitoring automation is not available."},{status:403});
  try{return Response.json(await evaluateOperationalAutomation(auth.organizationId),{headers:{"cache-control":"private, no-store"}})}
  catch{return Response.json({ran:false,status:"unavailable"},{status:503,headers:{"cache-control":"private, no-store"}})}
}
