import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const WIDTH = 42;

function money(value) {
  const n = Number(value || 0);
  const cents = Math.round(n * 100) % 100;
  return `PKR ${n.toLocaleString("en-PK", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function when(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pad(left, right, width = WIDTH) {
  const l = String(left ?? "");
  const r = String(right ?? "");
  const space = width - l.length - r.length;
  if (space <= 0) return `${l.slice(0, Math.max(0, width - r.length - 1))} ${r}`.slice(0, width);
  return `${l}${" ".repeat(space)}${r}`;
}

function dash() {
  return "-".repeat(WIDTH);
}

function encode(text) {
  return Buffer.from(String(text ?? ""), "ascii");
}

function slip(order, { restaurantName, organizationName, cashierName, copy }) {
  const isRestaurant = copy === "restaurant";
  const pay = order.payment_method || "Cash";
  const header = organizationName || restaurantName || "Restaurant";
  const chunks = [
    Buffer.from([0x1b, 0x61, 0x01]),
    encode(`${String(header).toUpperCase()}\n`),
    Buffer.from([0x1b, 0x45, 0x01]),
    encode(`${restaurantName || header}\n`),
    Buffer.from([0x1b, 0x45, 0x00]),
    encode(`${isRestaurant ? "RESTAURANT RECEIPT" : "CUSTOMER RECEIPT"}\n`),
    encode(`PAID - ${String(pay).toUpperCase()}\n`),
    Buffer.from([0x1b, 0x61, 0x00]),
    encode(`${dash()}\n`),
    encode(`${pad("Order", `#${order.order_no}`)}\n`),
    encode(`${pad("Table", order.table_label || "-")}\n`),
    encode(`${pad("Date", when(order.updated_at || order.created_at))}\n`),
    encode(`${pad("Payment", pay)}\n`),
  ];
  if (isRestaurant && cashierName) {
    chunks.push(encode(`${pad("Collected by", cashierName)}\n`));
  }
  chunks.push(encode(`${dash()}\n`));
  for (const item of order.items || []) {
    chunks.push(
      encode(`${pad(`${item.qty} x ${item.name}`, money(Number(item.price) * Number(item.qty)))}\n`)
    );
  }
  chunks.push(encode(`${dash()}\n`));
  chunks.push(encode(`${pad("Subtotal", money(order.subtotal))}\n`));
  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(encode(`${pad("Total", money(order.total))}\n`));
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));
  chunks.push(Buffer.from([0x1b, 0x61, 0x01]));
  chunks.push(
    encode(
      isRestaurant
        ? "Keep this copy at the resort for accounts.\n"
        : "Thank you for dining with us.\n"
    )
  );
  chunks.push(Buffer.from([0x1b, 0x61, 0x00]));
  chunks.push(encode("\n"));
  return Buffer.concat(chunks);
}

export function buildEscPos(order, meta) {
  const copy = meta.copy === "customer" ? "customer" : "restaurant";
  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    slip(order, { ...meta, copy }),
    encode("\n\n"),
    Buffer.from([0x1d, 0x56, 0x41, 0x10]),
  ]);
}

async function printerNames() {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"],
    { windowsHide: true, timeout: 15000 }
  );
  return String(stdout)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickPrinter(names) {
  const score = (name) => {
    const n = name.toLowerCase();
    if (n.includes("pos-80") || n.includes("pos80")) return 100;
    if (n.includes("pos 80")) return 95;
    if (n.includes("pos")) return 80;
    if (n.includes("thermal") || n.includes("receipt")) return 70;
    return 0;
  };
  return [...names].sort((a, b) => score(b) - score(a))[0] || null;
}

async function sendRaw(printerName, bytes) {
  const file = path.join(os.tmpdir(), `tdcp-receipt-${Date.now()}.bin`);
  fs.writeFileSync(file, bytes);
  const script = `
$ErrorActionPreference = 'Stop'
$printer = ${JSON.stringify(printerName)}
$path = ${JSON.stringify(file)}
if (-not ("RawPrinterHelper" -as [type])) {
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "TDCP Receipt";
    di.pDataType = "RAW";
    if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
    if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
    int dwWritten;
    bool ok = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
    Marshal.FreeCoTaskMem(pUnmanagedBytes);
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    return ok && dwWritten == bytes.Length;
  }
}
"@
}
$bytes = [System.IO.File]::ReadAllBytes($path)
$ok = [RawPrinterHelper]::SendBytesToPrinter($printer, $bytes)
if (-not $ok) { throw "WritePrinter failed for $printer" }
"OK"
`;
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 25000 }
    );
    if (!String(stdout).includes("OK")) {
      throw new Error(String(stdout || "Printer did not accept the job"));
    }
  } finally {
    fs.unlink(file, () => {});
  }
}

export async function printReceiptOnWindows(order, meta = {}) {
  if (process.platform !== "win32") {
    const err = new Error("Raw POS printing is only available on Windows.");
    err.code = "NOT_WINDOWS";
    throw err;
  }
  const names = await printerNames();
  if (!names.length) {
    const err = new Error("No printers found on this computer.");
    err.code = "NO_PRINTER";
    throw err;
  }
  const printer = pickPrinter(names);
  const payload = buildEscPos(order, meta);
  await sendRaw(printer, payload);
  return { printer, printers: names };
}
