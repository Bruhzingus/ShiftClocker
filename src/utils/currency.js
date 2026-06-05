// Active currency symbol. Money is formatted in dozens of places via
// formatMoney(); rather than thread a symbol through every call site we keep a
// single module-level symbol that App.js sets once from settings.currency (and
// updates whenever the user changes it). formatMoney() in helpers.js reads this
// as its default, so existing call sites need no change.

let activeSymbol = '$';

// Where the symbol sits relative to the number. A few currencies (none in our
// default list) prefer a trailing symbol, but we keep this simple: leading.
export function setCurrencySymbol(sym) {
  if (typeof sym === 'string' && sym.trim()) activeSymbol = sym.trim();
  else activeSymbol = '$';
}

export function getCurrencySymbol() {
  return activeSymbol;
}

// Curated options shown in the Settings picker. `custom` lets the user type any
// symbol (e.g. kr, zł, R$). Kept short so the dropdown stays scannable.
export const CURRENCY_OPTIONS = [
  { value: '$',   label: 'Dollar ($)' },
  { value: 'CA$', label: 'Canadian dollar (CA$)' },
  { value: 'A$',  label: 'Australian dollar (A$)' },
  { value: '£',   label: 'Pound (£)' },
  { value: '€',   label: 'Euro (€)' },
  { value: '₹',   label: 'Rupee (₹)' },
  { value: '¥',   label: 'Yen / Yuan (¥)' },
  { value: 'kr',  label: 'Krona / Krone (kr)' },
];
