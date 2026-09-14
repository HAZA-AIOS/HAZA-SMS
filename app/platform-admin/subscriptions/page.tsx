import { env } from "cloudflare:workers";
import { notFound, redirect } from "next/navigation";
import PlatformSubscriptionsPanel, { type PaymentReview } from "../../PlatformSubscriptionsPanel";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";
import { isPlatformAdminEmail } from "../../../lib/subscriptions";

export const dynamic="force-dynamic";
export default async function PlatformSubscriptionsPage(){const user=await getChatGPTUser();if(!user)redirect(chatGPTSignInPath("/platform-admin/subscriptions"));if(!isPlatformAdminEmail(user.email))notFound();const rows=await env.DB.prepare("SELECT sp.id,o.name school_name,sp.plan,sp.amount_pkr,sp.payment_method,sp.payment_reference,sp.payer_name,sp.receipt_name,sp.submitted_at FROM subscription_payments sp JOIN organizations o ON o.id=sp.organization_id WHERE sp.status='pending' ORDER BY sp.submitted_at").all<PaymentReview>();return <PlatformSubscriptionsPanel payments={rows.results}/>;}
