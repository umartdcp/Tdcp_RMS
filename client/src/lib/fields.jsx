export const PHONE_LEN = 11;
export const CNIC_LEN = 13;

export function digitsOnly(value, max) {
  const d = String(value || "").replace(/\D/g, "");
  return max ? d.slice(0, max) : d;
}

export function lettersOnly(value) {
  return String(value || "").replace(/[^A-Za-z\u0600-\u06FF\s'.-]/g, "");
}

export function textNameOnly(value) {
  return String(value || "").replace(/[^A-Za-z\u0600-\u06FF\s'.&\-]/g, "");
}

export function decimalOnly(value) {
  let next = String(value || "").replace(/[^0-9.]/g, "");
  const firstDot = next.indexOf(".");
  if (firstDot !== -1) {
    next = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, "");
  }
  return next;
}

export function formatPkPhone(value) {
  const d = digitsOnly(value, PHONE_LEN);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}

export function formatPkCnic(value) {
  const d = digitsOnly(value, CNIC_LEN);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function isPkPhone(value) {
  return /^03\d{9}$/.test(digitsOnly(value));
}

export function isPkCnic(value) {
  return /^\d{13}$/.test(digitsOnly(value));
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function isPersonName(value) {
  const v = String(value || "").trim();
  return /^[A-Za-z\u0600-\u06FF]+(?:[ '\-.][A-Za-z\u0600-\u06FF]+)*$/.test(v);
}

export function isTextName(value) {
  const v = String(value || "").trim();
  return /^[A-Za-z\u0600-\u06FF]+(?:[ '\-.&][A-Za-z\u0600-\u06FF]+)*$/.test(v);
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-medium text-rose-500">{message}</p>;
}
