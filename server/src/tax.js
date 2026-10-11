export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function withTax(subtotal) {
  const base = roundMoney(subtotal);
  return { subtotal: base, tax: 0, total: base };
}
