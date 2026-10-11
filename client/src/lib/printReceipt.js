import api from "../api";
import { formatPKR } from "./format";

function when(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label, value, strong) {
  return `<div class="row${strong ? " strong" : ""}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function slip({ order, restaurantName, cashierName, copy, logo, orgName }) {
  const isRestaurant = copy === "restaurant";
  const pay = order.payment_method || "Cash";
  const items = (order.items || [])
    .map(
      (item) =>
        `<div class="row"><span>${escapeHtml(item.qty)} × ${escapeHtml(item.name)}</span><span>${escapeHtml(
          formatPKR(Number(item.price) * Number(item.qty))
        )}</span></div>`
    )
    .join("");

  return `
    <article class="slip">
      <header>
        ${logo ? `<img src="${logo}" width="52" height="52" alt="" />` : ""}
        <p class="org">${escapeHtml(orgName || restaurantName || "Restaurant")}</p>
        <h1>${escapeHtml(restaurantName || "Restaurant")}</h1>
        <p class="badge ${isRestaurant ? "kitchen" : "guest"}">${isRestaurant ? "Restaurant receipt" : "Customer receipt"}</p>
        <p class="paid">PAID · ${escapeHtml(pay).toUpperCase()}</p>
      </header>
      <div class="box">
        ${row("Order", `#${order.order_no}`, true)}
        ${row("Table", order.table_label || "—")}
        ${row("Date", when(order.updated_at || order.created_at))}
        ${row("Payment", pay)}
        ${isRestaurant && cashierName ? row("Collected by", cashierName) : ""}
      </div>
      <div class="items">${items}</div>
      <div class="totals">
        <div class="row total"><span>Total</span><span>${escapeHtml(formatPKR(order.total))}</span></div>
      </div>
      <p class="foot">${
        isRestaurant
          ? "Keep this copy at the resort for accounts."
          : "Thank you for dining with us."
      }</p>
    </article>
  `;
}

async function logoSrc() {
  let org = null;
  try {
    org = JSON.parse(localStorage.getItem("rms_organization") || "null");
  } catch {
    org = null;
  }
  const url = String(org?.logo_url || "").trim();
  const isTdcp = String(org?.code || "").toUpperCase() === "TDCP";
  if (!url || (/tdcp-logo/i.test(url) && !isTdcp)) return "";
  try {
    const res = await fetch(url.startsWith("http") || url.startsWith("data:") ? url : `${window.location.origin}${url}`);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function receiptHtml({ order, restaurantName, cashierName, logo }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escapeHtml(order.order_no)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #111111 !important;
      font-family: Arial, Helvetica, sans-serif;
    }
    body { padding: 10px; }
    .slip { width: 72mm; max-width: 100%; margin: 0 auto 12px; color: #111111 !important; }
    header { text-align: center; }
    header img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
    .org { margin: 6px 0 0; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #333; }
    h1 { margin: 4px 0 0; font-size: 15px; color: #111; }
    .badge { display: inline-block; margin: 6px 0 0; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .kitchen { background: #0a4330; color: #fff; }
    .guest { background: #e8f6ef; color: #0c553c; }
    .paid { margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #0c553c; }
    .box { margin-top: 10px; padding: 8px 0; border-top: 1px dashed #666; border-bottom: 1px dashed #666; }
    .items { margin-top: 8px; }
    .totals { margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin: 3px 0; color: #111 !important; }
    .row.strong span:last-child, .row.total { font-weight: 700; }
    .row.total { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #666; font-size: 14px; }
    .foot { margin: 10px 0 0; text-align: center; font-size: 11px; color: #333; }
    .cut { border: 0; border-top: 1px dashed #666; margin: 14px 0; }
    @media print {
      html, body { background: #fff !important; color: #111 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0; }
      .slip { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${slip({ order, restaurantName, cashierName, copy: "restaurant", logo })}
  <hr class="cut" />
  ${slip({ order, restaurantName, cashierName, copy: "customer", logo })}
</body>
</html>`;
}

function printViaPopup(html) {
  const popup = window.open("", "tdcp-receipt", "width=420,height=720,scrollbars=yes");
  if (!popup) {
    window.alert("Allow pop-ups to print the receipt.");
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  const run = () => {
    popup.print();
  };
  popup.onload = () => setTimeout(run, 250);
  setTimeout(run, 600);
}

export async function printReceipts({ order, restaurantName, cashierName, copy = "restaurant" }) {
  if (!order) return { ok: false };
  const which = copy === "customer" ? "customer" : "restaurant";
  try {
    const { data } = await api.post("/print/receipt", {
      order,
      restaurantName,
      cashierName,
      copy: which,
    });
    return { ok: Boolean(data?.ok), copy: which, message: data?.message };
  } catch (err) {
    const message = err.response?.data?.message || err.message || "Could not print.";
    window.alert(message);
    return { ok: false, message };
  }
}
