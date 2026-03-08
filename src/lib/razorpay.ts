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

/* ── Payment Links (list) ────────────────────────── */

export async function getPaymentLinks(from?: number, to?: number) {
  const params: Record<string, string> = {};
  if (from) params.from = String(from);
  if (to) params.to = String(to);
  return paginateAll("/payment_links", params);
}

/* ── POST helper ─────────────────────────────────── */

export async function razorpayPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${RAZORPAY_BASE_URL}${endpoint}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay API error ${res.status}: ${text}`);
  }

  return res.json();
}

/* ── Payment Links ───────────────────────────────── */

export interface CreatePaymentLinkParams {
  amountInRupees: number;
  currency?: string;
  description: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  notifySms: boolean;
  notifyEmail: boolean;
  expireByUnix?: number;
  notes?: Record<string, string>;
}

export async function createPaymentLink(params: CreatePaymentLinkParams) {
  const body: Record<string, unknown> = {
    amount: Math.round(params.amountInRupees * 100),
    currency: params.currency || "INR",
    description: params.description,
    customer: {
      name: params.customerName,
      ...(params.customerEmail ? { email: params.customerEmail } : {}),
      ...(params.customerPhone ? { contact: params.customerPhone } : {}),
    },
    notify: {
      sms: params.notifySms,
      email: params.notifyEmail,
    },
  };

  if (params.expireByUnix) body.expire_by = params.expireByUnix;
  if (params.notes) body.notes = params.notes;

  return razorpayPost("/payment_links", body);
}
