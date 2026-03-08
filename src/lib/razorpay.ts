const RAZORPAY_BASE_URL = "https://api.razorpay.com/v1";
const KEY_ID = process.env.RAZORPAY_TEST_API_KEY || "";
const KEY_SECRET = process.env.RAZORPAY_TEST_KEY_SECRET || "";

function getAuthHeader() {
  return "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
}

export async function razorpayFetch(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${RAZORPAY_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay API error ${res.status}: ${text}`);
  }

  return res.json();
}

/** Paginate through all results using count+skip (Razorpay style) */
export async function paginateAll(
  endpoint: string,
  params?: Record<string, string>,
  maxPages = 20
) {
  const allItems: unknown[] = [];
  const count = 100;

  for (let page = 0; page < maxPages; page++) {
    const skip = page * count;
    const data = await razorpayFetch(endpoint, {
      ...params,
      count: String(count),
      skip: String(skip),
    });

    const items = data.items || [];
    allItems.push(...items);

    if (items.length < count) break;
  }

  return allItems;
}

/* ── Payments ─────────────────────────────────────── */

export async function getPayments(from?: number, to?: number) {
  const params: Record<string, string> = {};
  if (from) params.from = String(from);
  if (to) params.to = String(to);
  return paginateAll("/payments", params);
}

/* ── Settlements ──────────────────────────────────── */

export async function getSettlements(from?: number, to?: number) {
  const params: Record<string, string> = {};
  if (from) params.from = String(from);
  if (to) params.to = String(to);
  return paginateAll("/settlements", params);
}

/* ── Refunds ──────────────────────────────────────── */

export async function getRefunds(from?: number, to?: number) {
  const params: Record<string, string> = {};
  if (from) params.from = String(from);
  if (to) params.to = String(to);
  return paginateAll("/refunds", params);
}

/* ── Invoices ─────────────────────────────────────── */

export async function getInvoices(from?: number, to?: number) {
  const params: Record<string, string> = {};
  if (from) params.from = String(from);
  if (to) params.to = String(to);
  return paginateAll("/invoices", params);
}

/* ── Payment Pages ───────────────────────────────── */

export async function getPaymentPages() {
  return paginateAll("/payment_pages");
}
