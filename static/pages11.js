/* ============ pages11: Invoice Studio — client invoices for won work ============ */
"use strict";

let INV_ITEMS_EDIT = [];

ROUTES.invoices = {
  title: "Invoices",
  subtitle: "Bill clients for won deals — track what's paid and what's outstanding.",
  async render(page) {
    refreshCurrentList = () => ROUTES.invoices.render(document.getElementById("page"));
    page.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn primary" id="inv-new" data-perm="create">${icon("plus", 15)} New invoice</button>
      </div>
      <div class="grid cols-4" id="inv-stats">${Array(4).fill('<div class="card"><div class="skel skel-line" style="width:50%"></div><div class="skel" style="height:26px;width:60%;margin-top:10px"></div></div>').join("")}</div>
      <div class="card" style="margin-top:14px;padding:0;overflow:hidden">
        <div style="padding:16px 16px 10px"><h3 style="margin:0">Client invoices</h3>
          <div class="card-sub">Numbers auto-increment per year. Status changes are saved instantly.</div></div>
        <div id="inv-table">${skeletonTable(6)}</div>
      </div>`;
    document.getElementById("inv-new").onclick = () => openInvoiceModal();

    let invs, summary, deals;
    try {
      [invs, summary, deals] = await Promise.all([
        api("/api/client-invoices"), api("/api/client-invoices/summary"), api("/api/deals")]);
    } catch (e) { toast(e.message, { type: "error" }); return; }
    renderInvoices(invs, summary, deals);
  },
};

function invMoney(n, cur) { return (cur || "$") + Math.round(n || 0).toLocaleString(); }

function renderInvoices(invs, s, deals) {
  const stats = [
    { label: "Outstanding", value: invMoney(s.outstanding), ico: "briefcase", sub: "sent, awaiting payment" },
    { label: "Paid this month", value: invMoney(s.paid_month), ico: "dollar", sub: `${invMoney(s.paid_year)} year to date` },
    { label: "Overdue", value: String(s.overdue), ico: "clock", sub: s.overdue ? "chase these today" : "all on track" },
    { label: "Total invoices", value: String(s.count), ico: "file", sub: "drafts included" },
  ];
  document.getElementById("inv-stats").innerHTML = stats.map(st => `
    <div class="card stat-card fade-in">
      <div class="stat-top"><span class="stat-label">${icon(st.ico, 15)} ${st.label}</span></div>
      <div class="stat-value" style="font-size:24px">${st.value}</div>
      <div class="muted" style="font-size:12px;margin-top:3px">${st.sub}</div>
    </div>`).join("");

  const box = document.getElementById("inv-table");
  if (!invs.length) {
    box.innerHTML = emptyState({ icon: "file", title: "No invoices yet", message: "Win a deal, then bill for it here.", actionLabel: "Create invoice", actionId: "inv-empty-new" });
    const b = document.getElementById("inv-empty-new"); if (b) b.onclick = () => openInvoiceModal();
    return;
  }
  const badge = { draft: "gray", sent: "purple", paid: "green", overdue: "red" };
  box.innerHTML = `<table class="table"><thead><tr>
      <th>Number</th><th>Client</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th><th></th>
    </tr></thead><tbody>
    ${invs.map(i => `
      <tr data-inv="${i.id}">
        <td><b>${esc(i.number)}</b></td>
        <td>${esc(i.client)}<br><span class="faint" style="font-size:11px">${i.items.length} line item${i.items.length === 1 ? "" : "s"}</span></td>
        <td style="font-weight:700;color:${i.status === "paid" ? "#34d399" : "var(--text)"}">${invMoney(i.total, i.currency)}</td>
        <td class="faint" style="font-size:12px;white-space:nowrap">${i.issue_date}</td>
        <td class="faint" style="font-size:12px;white-space:nowrap">${i.due_date}</td>
        <td><select class="input" data-istatus style="padding:5px 8px;font-size:12px;width:auto">
          ${["draft", "sent", "paid", "overdue"].map(st => `<option ${st === i.status ? "selected" : ""}>${st}</option>`).join("")}</select></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="icon-btn" data-view title="View">${icon("file", 14)}</button>
          <button class="icon-btn danger" data-del title="Delete">${icon("trash", 14)}</button></td>
      </tr>`).join("")}
    </tbody></table>`;
  box.querySelectorAll("tr[data-inv]").forEach(tr => {
    const inv = invs.find(x => x.id === +tr.dataset.inv);
    tr.querySelector("[data-istatus]").onchange = async e => {
      try {
        await api(`/api/client-invoices/${inv.id}`, { method: "PATCH", body: { status: e.target.value } });
        toast(e.target.value === "paid" ? `Invoice ${inv.number} marked paid 💰` : `Invoice moved to ${e.target.value}`,
              { type: e.target.value === "overdue" ? "info" : "success" });
        refreshCurrentList();
      } catch (err) { toast(err.message, { type: "error" }); }
    };
    tr.querySelector("[data-view]").onclick = () => openInvoiceView(inv);
    tr.querySelector("[data-del]").onclick = async () => {
      const ok = await confirmModal({ title: "Delete invoice", message: `Delete ${inv.number} for ${inv.client} (${invMoney(inv.total, inv.currency)})?` });
      if (!ok) return;
      await api(`/api/client-invoices/${inv.id}`, { method: "DELETE" });
      toast("Invoice deleted", { type: "info" });
      refreshCurrentList();
    };
  });
}

function invoiceText(inv) {
  let t = `INVOICE ${inv.number}\nBill to: ${inv.client}\nIssued: ${inv.issue_date} · Due: ${inv.due_date}\n\nITEMS\n`;
  inv.items.forEach((it, i) => t += `${i + 1}. ${it.description} — ${inv.currency}${Number(it.amount).toLocaleString()}\n`);
  t += `\nTOTAL: ${inv.currency}${Math.round(inv.total).toLocaleString()}`;
  if (inv.notes) t += `\n\nNOTES\n${inv.notes}`;
  return t;
}

function openInvoiceView(inv) {
  const m = openModal({
    title: `Invoice ${esc(inv.number)}`,
    wide: true,
    body: `
      <div class="card" style="margin:0;border-color:rgba(139,92,246,.4)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div><b style="font-size:18px" class="grad-text">${esc(inv.number)}</b>
            <div class="faint" style="font-size:12px;margin-top:2px">Bill to: <b>${esc(inv.client)}</b></div></div>
          <div style="text-align:right" class="faint" style="font-size:12px">
            <div>Issued: ${inv.issue_date}</div><div>Due: ${inv.due_date}</div>
            <span class="badge ${inv.status === "paid" ? "green" : inv.status === "overdue" ? "red" : inv.status === "sent" ? "purple" : "gray"}">${inv.status}</span>
          </div>
        </div>
        <table class="table" style="margin-top:14px"><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
          ${inv.items.map(it => `<tr><td>${esc(it.description)}</td><td style="text-align:right">${inv.currency}${Number(it.amount).toLocaleString()}</td></tr>`).join("")}
          <tr><td><b>Total</b></td><td style="text-align:right"><b style="font-size:15px">${inv.currency}${Math.round(inv.total).toLocaleString()}</b></td></tr>
        </tbody></table>
        ${inv.notes ? `<p class="faint" style="font-size:12px;margin-top:12px">${esc(inv.notes)}</p>` : ""}
      </div>`,
    foot: `<button class="btn" data-close>Close</button>
      <button class="btn" id="iv-copy">${icon("copy", 14)} Copy text</button>
      <button class="btn primary" id="iv-html">${icon("file", 14)} Download HTML</button>`,
  });
  m.el.querySelector("#iv-copy").onclick = () => copyText(invoiceText(inv), "Invoice");
  m.el.querySelector("#iv-html").onclick = () => downloadInvoiceHTML(inv);
}

function downloadInvoiceHTML(inv) {
  const rows = inv.items.map(it => `
    <tr><td>${esc(it.description)}</td><td class="amt">${inv.currency}${Number(it.amount).toLocaleString()}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0a0c12;color:#e8eaf2;max-width:720px;margin:36px auto;padding:0 22px}
h1{background:linear-gradient(90deg,#8b5cf6,#d946ef);-webkit-background-clip:text;background-clip:text;color:transparent;margin:4px 0}
.meta{color:#9aa1b5;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:10px;border-bottom:1px solid #232736}
.amt{text-align:right;white-space:nowrap}.total td{font-weight:800;font-size:16px;border-top:2px solid #8b5cf6}
.notes{color:#9aa1b5;font-size:12.5px;margin-top:18px;line-height:1.6}.foot{color:#6b7280;font-size:11px;margin-top:30px}</style></head><body>
<h1>INVOICE ${esc(inv.number)}</h1>
<div class="meta">Bill to: <b>${esc(inv.client)}</b><br>Issued ${inv.issue_date} · Due ${inv.due_date} · Status: ${inv.status}</div>
<table>${rows}<tr class="total"><td>Total</td><td class="amt">${inv.currency}${Math.round(inv.total).toLocaleString()}</td></tr></table>
${inv.notes ? `<div class="notes">${esc(inv.notes)}</div>` : ""}
<div class="foot">Generated with Lumina — AI Social Media Suite</div>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${inv.number.toLowerCase()}-${inv.client.replace(/[^\w-]+/g, "-").toLowerCase()}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Invoice downloaded");
}

function openInvoiceModal(deals) {
  INV_ITEMS_EDIT = [{ description: "", amount: "" }];
  (async () => {
    let dealList = [];
    try { dealList = (await api("/api/deals")).filter(d => d.status === "won"); } catch (e) { /* optional helper */ }
    const m = openModal({
      title: "New client invoice",
      wide: true,
      body: `
        ${dealList.length ? `
        <div class="field"><label>Import from a won deal (optional)</label>
          <select class="input" id="in-deal"><option value="">— start blank —</option>
            ${dealList.map(d => `<option value="${d.id}">${esc(d.brand)} · ${fmtMoney(d.amount)} · ${d.deal_date}</option>`).join("")}
          </select></div>` : ""}
        <div class="grid cols-2" style="gap:12px">
          <div class="field"><label>Client</label><input class="input" id="in-client" placeholder="e.g. Brewline Coffee"></div>
          <div class="field"><label>Currency</label><select class="input" id="in-cur"><option>$</option><option>€</option><option>£</option><option>₹</option></select></div>
          <div class="field"><label>Issue date</label><input class="input" id="in-issue" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Due date</label><input class="input" id="in-due" type="date" value="${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}"></div>
        </div>
        <label style="font-size:12.5px;color:var(--muted);display:block;margin-bottom:6px">Line items</label>
        <div id="in-items" style="display:flex;flex-direction:column;gap:8px"></div>
        <button class="btn sm" id="in-add" style="margin-top:8px">${icon("plus", 12)} Add line</button>
        <div class="field" style="margin-top:12px"><label>Notes (payment terms, transfer details…)</label>
          <textarea class="input" id="in-notes" rows="2" placeholder="Payment via bank transfer — net 14."></textarea></div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="in-save">${icon("check", 14)} Create invoice</button>`,
    });

    const itemsBox = m.el.querySelector("#in-items");
    const drawItems = () => {
      itemsBox.innerHTML = INV_ITEMS_EDIT.map((it, i) => `
        <div style="display:flex;gap:8px;align-items:center">
          <input class="input" data-desc="${i}" placeholder="Description (e.g. 2 sponsored posts)" value="${esc(it.description)}" style="flex:1">
          <input class="input" data-amt="${i}" type="number" min="0" placeholder="amount" value="${esc(String(it.amount))}" style="width:120px">
          <button class="icon-btn danger" data-rm="${i}" ${INV_ITEMS_EDIT.length === 1 ? "disabled" : ""}>${icon("trash", 13)}</button>
        </div>`).join("");
      itemsBox.querySelectorAll("[data-desc]").forEach(el => el.oninput = e => INV_ITEMS_EDIT[+el.dataset.desc].description = e.target.value);
      itemsBox.querySelectorAll("[data-amt]").forEach(el => el.oninput = e => INV_ITEMS_EDIT[+el.dataset.amt].amount = e.target.value);
      itemsBox.querySelectorAll("[data-rm]").forEach(el => el.onclick = () => { INV_ITEMS_EDIT.splice(+el.dataset.rm, 1); drawItems(); });
    };
    drawItems();
    m.el.querySelector("#in-add").onclick = () => { INV_ITEMS_EDIT.push({ description: "", amount: "" }); drawItems(); };

    const dealSel = m.el.querySelector("#in-deal");
    if (dealSel) dealSel.onchange = () => {
      const d = dealList.find(x => x.id === +dealSel.value);
      if (!d) return;
      m.el.querySelector("#in-client").value = d.brand;
      INV_ITEMS_EDIT = [{ description: `${d.type} — ${PLATFORMS[d.platform]?.name || d.platform} campaign (${d.deal_date})`, amount: d.amount }];
      drawItems();
      toast("Prefilled from the won deal");
    };

    m.el.querySelector("#in-save").onclick = async () => {
      const items = INV_ITEMS_EDIT.filter(it => it.description.trim() || it.amount !== "");
      if (!items.length) { toast("Add at least one line item", { type: "info" }); return; }
      const btn = m.el.querySelector("#in-save");
      buttonLoading(btn, true);
      try {
        const inv = await api("/api/client-invoices", { method: "POST", body: {
          client: m.el.querySelector("#in-client").value.trim(),
          currency: m.el.querySelector("#in-cur").value,
          issue_date: m.el.querySelector("#in-issue").value,
          due_date: m.el.querySelector("#in-due").value,
          notes: m.el.querySelector("#in-notes").value.trim(),
          items: items.map(it => ({ description: it.description.trim(), amount: +it.amount || 0 })),
        }});
        m.close();
        toast(`Invoice ${inv.number} created — ${invMoney(inv.total, inv.currency)}`);
        refreshCurrentList();
      } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
    };
  })();
}
