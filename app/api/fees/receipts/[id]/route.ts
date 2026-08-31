import { env } from "cloudflare:workers";
import {
  authorize,
  requireCampusAccess,
} from "../../../../../lib/authorization";
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c]!,
  );
const money = (v: unknown) => `PKR ${Number(v || 0).toLocaleString()}`;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("fees.print");
  if (!auth) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const payment = await env.DB.prepare(
    "SELECT p.*,i.invoice_number,i.billing_month,i.total_amount,i.paid_amount,i.balance_amount,s.admission_number,s.first_name||' '||coalesce(s.last_name,'') student_name,o.name school_name,o.abbreviation,os.address school_address,os.phone school_phone,c.name campus_name,cs.address campus_address,u.display_name received_by_name FROM fee_payments p JOIN fee_invoices i ON i.id=p.invoice_id JOIN students s ON s.id=p.student_id JOIN organizations o ON o.id=p.organization_id LEFT JOIN organization_settings os ON os.organization_id=o.id JOIN campuses c ON c.id=p.campus_id LEFT JOIN campus_settings cs ON cs.campus_id=c.id LEFT JOIN users u ON u.id=p.received_by WHERE p.id=?1 AND p.organization_id=?2 AND p.status='posted'",
  )
    .bind(id, auth.organizationId)
    .first<Record<string, unknown>>();
  if (!payment) return new Response("Receipt not found", { status: 404 });
  const denied = await requireCampusAccess(
    auth,
    String(payment.campus_id),
    "fees.print",
  );
  if (denied) return denied;
  await env.DB.prepare(
    "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'fee.receipt.print','fee_payment',?5,'success')",
  )
    .bind(
      crypto.randomUUID(),
      auth.organizationId,
      payment.campus_id,
      auth.userId,
      id,
    )
    .run();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(payment.receipt_number)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17202a;margin:0}.receipt{max-width:760px;margin:auto;border:2px solid #173f63;border-radius:14px;overflow:hidden}.head{display:flex;align-items:center;gap:18px;padding:22px;background:#f2f7fb;border-bottom:4px solid #d3a322}.head img{width:76px;height:86px;object-fit:contain}.head h1{margin:0;color:#173f63;font-size:26px}.head p{margin:4px 0;color:#52616d}.title{text-align:center;padding:15px;background:#173f63;color:white}.title h2{margin:0}.body{padding:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 30px}.row{display:flex;justify-content:space-between;border-bottom:1px dashed #bbc5cb;padding:8px 0}.amount{margin:22px 0;background:#f7f2dd;border-radius:12px;padding:18px;display:grid;grid-template-columns:repeat(3,1fr);text-align:center}.amount b{display:block;font-size:20px;color:#173f63;margin-top:4px}.foot{display:flex;justify-content:space-between;margin-top:42px}.sign{border-top:1px solid #333;padding-top:7px;width:190px;text-align:center}.note{text-align:center;color:#6d7880;font-size:12px;margin-top:28px}@media print{button{display:none}.receipt{border-color:#333}}button{display:block;margin:18px auto;border:0;border-radius:9px;background:#173f63;color:white;padding:11px 18px}</style></head><body><div class="receipt"><div class="head"><img src="/tms-original-logo-transparent.png" alt="School logo"><div><h1>${esc(payment.school_name)}</h1><p>${esc(payment.campus_name)} · ${esc(payment.campus_address || payment.school_address)}</p><p>${esc(payment.school_phone || "")}</p></div></div><div class="title"><h2>FEE PAYMENT RECEIPT</h2><small>${esc(payment.receipt_number)}</small></div><div class="body"><div class="grid"><div class="row"><span>Student</span><b>${esc(payment.student_name)}</b></div><div class="row"><span>Admission No.</span><b>${esc(payment.admission_number)}</b></div><div class="row"><span>Invoice</span><b>${esc(payment.invoice_number)}</b></div><div class="row"><span>Billing month</span><b>${esc(payment.billing_month)}</b></div><div class="row"><span>Payment date</span><b>${esc(payment.payment_date)}</b></div><div class="row"><span>Method</span><b>${esc(String(payment.payment_method).toUpperCase())}</b></div></div><div class="amount"><span>Received<b>${money(payment.amount)}</b></span><span>Total paid<b>${money(payment.paid_amount)}</b></span><span>Balance<b>${money(payment.balance_amount)}</b></span></div>${payment.reference_number ? `<div class="row"><span>Reference</span><b>${esc(payment.reference_number)}</b></div>` : ""}${payment.notes ? `<div class="row"><span>Notes</span><b>${esc(payment.notes)}</b></div>` : ""}<div class="foot"><span>Received by: <b>${esc(payment.received_by_name || "Authorized cashier")}</b></span><span class="sign">Authorized signature</span></div><p class="note">Computer-generated receipt. Please retain it for your records.</p></div></div><button onclick="window.print()">Print receipt</button></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
