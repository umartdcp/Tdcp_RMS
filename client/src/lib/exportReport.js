import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function money(value) {
  return Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function pct(value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function slug(name) {
  return String(name || "tdcp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function buildReportModel(data, { trendRange, catRange, restaurant, generatedAt, organization }) {
  const orgName = organization?.name || restaurant || "Sales Report";
  const s = data.summary;
  const p = data.periods;
  const trend = data.trend?.range || data.trend?.[trendRange] || [];
  const cats = data.categories?.range || data.categories?.[catRange] || [];
  const catTotal = cats.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const trendLabel = data.trend?.range
    ? "Selected dates"
    : { 7: "Last 7 days", 14: "Last 14 days", 30: "Last 30 days" }[trendRange] || "Selected period";
  const catLabel = data.categories?.range
    ? "Selected dates"
    : { week: "This week", month: "This month", year: "This year" }[catRange] || "Selected period";
  const daily = data.trend?.range || data.trend?.["7"] || trend.slice(-7);

  return {
    title: `${orgName} Sales Report`,
    restaurant: restaurant || orgName,
    orgName,
    logoUrl: organization?.logo_url && !(/tdcp-logo/i.test(organization.logo_url) && String(organization.code).toUpperCase() !== "TDCP")
      ? organization.logo_url
      : String(organization?.code || "").toUpperCase() === "TDCP"
        ? organization?.logo_url || "/tdcp-logo.png"
        : "",
    generatedAt,
    trendLabel,
    catLabel,
    kpiMeta: [
      { label: "Today's Revenue (PKR)", value: money(s.revenue), change: s.revenueChange, suffix: "vs yesterday" },
      { label: "Today's Orders", value: String(s.orders), change: s.ordersChange, suffix: "vs yesterday" },
      { label: "Average Ticket (PKR)", value: money(s.avg_ticket), change: s.ticketChange, suffix: "vs yesterday" },
      { label: "Customers Served Today", value: String(s.customers), change: s.customersChange, suffix: "vs yesterday" },
    ],
    kpis: [
      ["Today's revenue (PKR)", money(s.revenue), `${pct(s.revenueChange)} vs yesterday`],
      ["Today's orders", String(s.orders), `${pct(s.ordersChange)} vs yesterday`],
      ["Average ticket (PKR)", money(s.avg_ticket), `${pct(s.ticketChange)} vs yesterday`],
      ["Customers served today", String(s.customers), `${pct(s.customersChange)} vs yesterday`],
    ],
    periods: [
      ["This Week (PKR)", money(p.week), `${pct(p.weekChange)} vs last week`],
      ["This Month (PKR)", money(p.month), `${pct(p.monthChange)} vs last month`],
      ["This Year (PKR)", money(p.year), `${pct(p.yearChange)} vs last year`],
    ],
    trend: trend.map((r) => [r.date || r.day, money(r.sales)]),
    daily7: daily.map((r) => [r.date || r.day, money(r.sales)]),
    spark: daily.map((r) => Number(r.sales) || 0),
    categories: cats.map((r) => {
      const share = catTotal ? Math.round((Number(r.amount) / catTotal) * 100) : 0;
      return [r.name, money(r.amount), `${share}%`];
    }),
    catTotal: money(catTotal),
    fileBase: `tdcp-sales-report-${slug(restaurant)}-${fileStamp()}`,
  };
}

async function loadLogo(src) {
  if (!src) return null;
  try {
    const url = src.startsWith("http") || src.startsWith("data:") || src.startsWith("/") ? src : `/${src}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function sparkline(doc, x, y, w, h, values, color) {
  const nums = values.length ? values : [0, 0];
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const step = nums.length > 1 ? w / (nums.length - 1) : w;
  doc.setDrawColor(...color);
  doc.setLineWidth(1.1);
  let prev = null;
  nums.forEach((v, i) => {
    const px = x + i * step;
    const py = y + h - ((Number(v) - min) / span) * h;
    if (prev) doc.line(prev.x, prev.y, px, py);
    prev = { x: px, y: py };
  });
}

function changeChip(doc, x, y, value, suffix) {
  const n = Number(value) || 0;
  const up = n > 0;
  const flat = n === 0;
  const label = `${n > 0 ? "+" : ""}${n.toFixed(1)}% ${suffix}`;
  if (flat) {
    doc.setFillColor(226, 232, 240);
    doc.circle(x + 4, y - 3, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("-", x + 4, y - 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(label, x + 12, y);
    return;
  }
  doc.setFillColor(up ? 16 : 244, up ? 185 : 63, up ? 129 : 94);
  doc.circle(x + 4, y - 3, 4.2, "F");
  doc.setFillColor(255, 255, 255);
  if (up) doc.triangle(x + 4, y - 6, x + 1.6, y - 1.4, x + 6.4, y - 1.4, "F");
  else doc.triangle(x + 4, y - 0.6, x + 1.6, y - 5.2, x + 6.4, y - 5.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(up ? 5 : 190, up ? 150 : 24, up ? 105 : 24);
  doc.text(label, x + 12, y);
}

export async function downloadReportPdf(model) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 28;
  const inner = pageW - margin * 2;
  const logo = await loadLogo(model.logoUrl);
  const green = [12, 85, 60];
  let y = 32;

  doc.setDrawColor(228, 236, 232);
  doc.setLineWidth(0.8);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(18, 16, pageW - 36, 810, 14, 14, "S");

  doc.setFillColor(...green);
  doc.circle(margin + 18, y + 16, 18, "F");
  if (logo) doc.addImage(logo, "PNG", margin + 5, y + 3, 26, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...green);
  doc.text(model.title || "Sales Report", margin + 44, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 96, 90);
  doc.text(model.restaurant, margin + 44, y + 28);

  if (logo) doc.addImage(logo, "PNG", pageW - margin - 122, y + 2, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...green);
  doc.text(model.orgName || model.restaurant || "Restaurant", pageW - margin, y + 11, { align: "right" });
  doc.text("Management System", pageW - margin, y + 22, { align: "right" });

  y += 48;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 132, 128);
  doc.text(`Generated on ${model.generatedAt}`, margin + 44, y);

  y += 16;
  const cards = model.kpiMeta;
  const gap = 8;
  const cardW = (inner - gap * 3) / 4;
  const cardH = 94;
  cards.forEach((card, i) => {
    const x = margin + i * (cardW + gap);
    doc.setFillColor(252, 255, 253);
    doc.setDrawColor(226, 237, 230);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, cardW, cardH, 10, 10, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 128, 120);
    doc.text(doc.splitTextToSize(card.label, cardW - 16), x + 10, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...green);
    doc.text(String(card.value), x + 10, y + 42);
    changeChip(doc, x + 10, y + 58, card.change, card.suffix);
    sparkline(
      doc,
      x + 10,
      y + 70,
      cardW - 20,
      14,
      model.spark,
      Number(card.value) === 0 ? [190, 200, 196] : [167, 201, 180]
    );
  });

  autoTable(doc, {
    startY: y + cardH + 16,
    head: [["Period Totals", "Value", "Change"]],
    body: model.periods,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
      lineColor: [232, 240, 236],
      lineWidth: 0.4,
      textColor: [40, 55, 50],
    },
    headStyles: { fillColor: green, textColor: 255, fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      0: { cellWidth: inner * 0.5, fontStyle: "bold", textColor: green },
      1: { cellWidth: inner * 0.2, halign: "right" },
      2: { cellWidth: inner * 0.3, textColor: [5, 150, 105] },
    },
    alternateRowStyles: { fillColor: [250, 253, 251] },
    margin: { left: margin, right: margin },
    tableWidth: inner,
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    head: [["Daily Sales — Last 7 Days", "Amount (PKR)"]],
    body: model.daily7.length ? model.daily7 : [["No paid sales in this period", "0"]],
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 10, right: 10 },
      lineColor: [232, 240, 236],
      lineWidth: 0.4,
      textColor: [40, 55, 50],
    },
    headStyles: { fillColor: green, textColor: 255, fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: green },
      1: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [250, 253, 251] },
    margin: { left: margin, right: margin },
    tableWidth: inner,
  });

  doc.save(`${model.fileBase}.pdf`);
}

export function downloadReportXlsx(model) {
  const wb = XLSX.utils.book_new();

  const summary = [
    [model.title],
    [model.restaurant],
    [`Generated on ${model.generatedAt}`],
    [],
    ["Today's snapshot", "Value", "Change"],
    ...model.kpis,
    [],
    ["Period totals", "Value", "Change"],
    ...model.periods,
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 32 }, { wch: 18 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const trendSheet = XLSX.utils.aoa_to_sheet([[`Daily sales — ${model.trendLabel}`, "Amount (PKR)"], ...model.trend]);
  trendSheet["!cols"] = [{ wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, trendSheet, "Daily sales");

  const catSheet = XLSX.utils.aoa_to_sheet([
    [`Sales by category — ${model.catLabel}`, "Amount (PKR)", "Share"],
    ...model.categories,
    ["Total", model.catTotal, "100%"],
  ]);
  catSheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, catSheet, "Categories");

  XLSX.writeFile(wb, `${model.fileBase}.xlsx`);
}
