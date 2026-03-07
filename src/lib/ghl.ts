const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

export async function ghlFetch(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${GHL_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getPipelines() {
  const data = await ghlFetch("/opportunities/pipelines", {
    locationId: LOCATION_ID,
  });
  return data.pipelines || [];
}

export async function searchOpportunities(pipelineId: string) {
  const allOpps: unknown[] = [];
  let page = 1;
  const limit = 50;

  // Paginate to get all opportunities
  while (true) {
    const data = await ghlFetch("/opportunities/search", {
      location_id: LOCATION_ID,
      pipeline_id: pipelineId,
      limit: String(limit),
      page: String(page),
    });
    const opps = data.opportunities || [];
    allOpps.push(...opps);

    // Stop if we got fewer than the limit (last page)
    if (opps.length < limit) break;
    page++;
    // Safety: max 10 pages (500 opps)
    if (page > 10) break;
  }

  return allOpps;
}

export async function getCalendars() {
  const data = await ghlFetch("/calendars/", {
    locationId: LOCATION_ID,
  });
  return data.calendars || [];
}

export async function getCalendarEvents(calendarId: string, startTime: string, endTime: string) {
  // GHL requires epoch timestamps in milliseconds
  const startEpoch = String(new Date(startTime).getTime());
  const endEpoch = String(new Date(endTime).getTime());
  const data = await ghlFetch("/calendars/events", {
    calendarId,
    startTime: startEpoch,
    endTime: endEpoch,
    locationId: LOCATION_ID,
  });
  return data.events || [];
}

export async function getUsers() {
  const data = await ghlFetch("/users/", {
    locationId: LOCATION_ID,
  });
  return data.users || [];
}

export async function getContact(contactId: string) {
  const data = await ghlFetch(`/contacts/${contactId}`);
  return data.contact || null;
}

export async function getFormSubmissionsByContact(contactId: string) {
  // GHL API doesn't support contactId filter, so fetch all and filter
  const allSubs: unknown[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const data = await ghlFetch("/forms/submissions", {
      locationId: LOCATION_ID,
      limit: String(limit),
      page: String(page),
    });
    const subs = data.submissions || [];
    allSubs.push(...subs);
    if (subs.length < limit) break;
    page++;
    if (page > 5) break; // Safety: max 500 submissions
  }

  // Filter by contactId client-side
  return allSubs.filter(
    (s: unknown) => (s as { contactId?: string }).contactId === contactId
  );
}

export async function getOpportunity(opportunityId: string) {
  const data = await ghlFetch(`/opportunities/${opportunityId}`);
  return data.opportunity || data || null;
}
