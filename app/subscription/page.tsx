import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { authorize, getOrganizationChoices } from "../../lib/authorization";
import { getOrganizationSubscription } from "../../lib/subscriptions";
import { getChatGPTUser } from "../chatgpt-auth";
import SubscriptionPanel from "../SubscriptionPanel";

export const dynamic="force-dynamic";
export default async function SubscriptionPage(){
  const user=await getChatGPTUser(); if(!user) redirect("/login");
  const auth=await authorize(undefined,{allowInactiveSubscription:true});
  if(!auth){const choices=await getOrganizationChoices(); if(choices.length>1) redirect("/?portal=dashboard"); redirect("/register");}
  const subscription=await getOrganizationSubscription(auth.organizationId); if(!subscription) throw new Error("Subscription record is missing.");
  const pending=await env.DB.prepare("SELECT id FROM subscription_payments WHERE organization_id=?1 AND status='pending' LIMIT 1").bind(auth.organizationId).first();
  return <SubscriptionPanel schoolName={auth.schoolName} subscription={subscription} pendingPayment={!!pending} now={Date.now()}/>;
}
