import { env } from "cloudflare:workers";
import {
  authorize,
  requireCampusAccess,
} from "../../../../../lib/authorization";

export const dynamic = "force-dynamic";
const iso = /^\d{4}-\d{2}-\d{2}$/;
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const csv = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  const auth = await authorize("finance.export");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to export financial reports." },
      { status: 403 },
    );
  const campusId = auth.activeCampusId ?? auth.campuses[0]?.id;
  if (!campusId)
    return Response.json(
      { error: "Select an active campus." },
      { status: 400 },
    );
  const denied = await requireCampusAccess(auth, campusId, "finance.export");
  if (denied) return denied;
  const url = new URL(request.url),
    today = new Date().toISOString().slice(0, 10),
    from = iso.test(url.searchParams.get("from") || "")
      ? url.searchParams.get("from")!
      : `${today.slice(0, 4)}-01-01`,
    to = iso.test(url.searchParams.get("to") || "")
      ? url.searchParams.get("to")!
      : today,
    format = url.searchParams.get("format") === "print" ? "print" : "csv";
  if (to < from)
    return Response.json(
      { error: "The report end date must not be before its start date." },
      { status: 400 },
    );
  const [campus, payments, expenses] = await Promise.all([
    env.DB.prepare(
      "SELECT name,address FROM campuses WHERE id=?1 AND organization_id=?2",
    )
      .bind(campusId, auth.organizationId)
      .first<Record<string, unknown>>(),
    env.DB.prepare(
      "SELECT p.payment_date date,'Fee receipt' type,p.receipt_number reference,s.first_name||' '||coalesce(s.last_name,'') party,a.name account,p.payment_method method,p.amount inflow,0 outflow,p.status FROM fee_payments p JOIN students s ON s.id=p.student_id LEFT JOIN financial_accounts a ON a.id=p.financial_account_id WHERE p.organization_id=?1 AND p.campus_id=?2 AND p.status='posted' AND p.payment_date BETWEEN ?3 AND ?4 ORDER BY p.payment_date",
    )
      .bind(auth.organizationId, campusId, from, to)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      "SELECT e.expense_date date,'Expense' type,coalesce(e.reference_number,'') reference,e.payee party,a.name account,e.payment_method method,0 inflow,e.amount outflow,e.status FROM expenses e LEFT JOIN financial_accounts a ON a.id=e.financial_account_id WHERE e.organization_id=?1 AND e.campus_id=?2 AND e.status='posted' AND e.expense_date BETWEEN ?3 AND ?4 ORDER BY e.expense_date",
    )
      .bind(auth.organizationId, campusId, from, to)
      .all<Record<string, unknown>>(),
  ]);
  const rows = [...payments.results, ...expenses.results].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    ),
    inflow = rows.reduce((sum, row) => sum + Number(row.inflow || 0), 0),
    outflow = rows.reduce((sum, row) => sum + Number(row.outflow || 0), 0);
  await env.DB.prepare(
    "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'finance.report.export','financial_report',?5,'success',?6)",
  )
    .bind(
      crypto.randomUUID(),
      auth.organizationId,
      campusId,
      `${from}:${to}`,
      JSON.stringify({ format, rows: rows.length }),
    )
    .run();
  if (format === "csv") {
    const header = [
        "Date",
        "Type",
        "Reference",
        "Party",
        "Account",
        "Method",
        "Inflow",
        "Outflow",
        "Status",
      ],
      body = rows.map((row) =>
        [
          row.date,
          row.type,
          row.reference,
          row.party,
          row.account,
          row.method,
          row.inflow,
          row.outflow,
          row.status,
        ]
          .map(csv)
          .join(","),
      );
    return new Response([header.map(csv).join(","), ...body].join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="financial-report-${from}-to-${to}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }
  const table = rows
    .map(
      (row) =>
        `<tr><td>${esc(row.date)}</td><td>${esc(row.type)}</td><td>${esc(row.reference)}</td><td>${esc(row.party)}</td><td>${esc(row.account || "Unallocated")}</td><td>${esc(row.method)}</td><td>${Number(row.inflow || 0).toLocaleString()}</td><td>${Number(row.outflow || 0).toLocaleString()}</td></tr>`,
    )
    .join("");
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Financial Report</title><style>body{font:14px Inter,Arial;color:#172b3c;margin:32px}header{display:flex;justify-content:space-between;border-bottom:3px solid #e4b848;padding-bottom:16px}h1{margin:0}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.summary div{padding:16px;background:#f4f7fb;border-radius:10px}.summary b{display:block;font-size:20px;margin-top:5px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #dce5ec;text-align:left}th{background:#081f34;color:white}@media print{button{display:none}body{margin:12mm}}</style></head><body><header><div><h1>${esc(auth.schoolName)}</h1><p>${esc(campus?.name)} · ${esc(campus?.address || "")}</p></div><div><b>Financial Report</b><p>${esc(from)} to ${esc(to)}</p></div></header><div class="summary"><div>Total inflow<b>PKR ${inflow.toLocaleString()}</b></div><div>Total outflow<b>PKR ${outflow.toLocaleString()}</b></div><div>Net cash<b>PKR ${(inflow - outflow).toLocaleString()}</b></div></div><button onclick="print()">Print report</button><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Party</th><th>Account</th><th>Method</th><th>Inflow</th><th>Outflow</th></tr></thead><tbody>${table}</tbody></table></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    },
  );
}
