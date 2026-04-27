import type { Client } from "./clients";

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export class HighLevelError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `HighLevel API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

type FetchInitPlus = RequestInit & {
  query?: Record<string, string | number | boolean | undefined | null>;
};

/**
 * Thin wrapper around the HighLevel (LeadConnector) v2 REST API, scoped to a
 * single sub-account via its Private Integration Token.
 */
export class HighLevel {
  constructor(private readonly client: Client) {}

  private async request<T = unknown>(
    path: string,
    init: FetchInitPlus = {},
  ): Promise<T> {
    const url = new URL(path, BASE);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.client.pit}`,
        Version: API_VERSION,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    const body = text ? safeJson(text) : null;
    if (!res.ok) {
      throw new HighLevelError(
        res.status,
        body,
        `HighLevel ${res.status}: ${path}`,
      );
    }
    return body as T;
  }

  // --- Location / account ---
  location() {
    return this.request<{ location: unknown }>(
      `/locations/${this.client.locationId}`,
    );
  }

  // --- Contacts ---
  searchContacts(params: { limit?: number; query?: string } = {}) {
    return this.request<{
      contacts: Array<ContactSummary>;
      total: number;
    }>("/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        locationId: this.client.locationId,
        pageLimit: params.limit ?? 20,
        query: params.query,
      }),
    });
  }

  recentContacts(limit = 50) {
    return this.request<{
      contacts: Array<ContactSummary>;
      total?: number;
    }>("/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        locationId: this.client.locationId,
        pageLimit: limit,
        sort: [{ field: "dateAdded", direction: "desc" }],
      }),
    });
  }

  addContactTags(contactId: string, tags: string[]) {
    return this.request<{ tags?: string[] }>(
      `/contacts/${contactId}/tags`,
      {
        method: "POST",
        body: JSON.stringify({ tags }),
      },
    );
  }

  // --- Outbound messaging ---
  sendSms(contactId: string, message: string) {
    return this.request<{
      messageId?: string;
      conversationId?: string;
      msg?: string;
    }>("/conversations/messages", {
      method: "POST",
      body: JSON.stringify({ type: "SMS", contactId, message }),
    });
  }

  sendEmail(args: {
    contactId: string;
    subject: string;
    html?: string;
    text?: string;
  }) {
    return this.request<{
      messageId?: string;
      conversationId?: string;
    }>("/conversations/messages", {
      method: "POST",
      body: JSON.stringify({
        type: "Email",
        contactId: args.contactId,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
  }

  getContact(contactId: string) {
    return this.request<{ contact: ContactSummary }>(
      `/contacts/${contactId}`,
    );
  }

  // --- Pipelines / Opportunities ---
  pipelines() {
    return this.request<{ pipelines: Pipeline[] }>("/opportunities/pipelines", {
      query: { locationId: this.client.locationId },
    });
  }

  searchOpportunities(
    params: {
      pipelineId?: string;
      limit?: number;
      status?: "open" | "won" | "lost" | "abandoned";
    } = {},
  ) {
    return this.request<{
      opportunities: Opportunity[];
      meta?: { total?: number };
      total?: number;
    }>("/opportunities/search", {
      query: {
        location_id: this.client.locationId,
        pipeline_id: params.pipelineId,
        status: params.status,
        limit: params.limit ?? 50,
      },
    });
  }

  // --- Conversations ---
  searchConversations(
    params: { limit?: number; unreadOnly?: boolean } = {},
  ) {
    return this.request<{
      conversations: Conversation[];
      total?: number;
    }>("/conversations/search", {
      query: {
        locationId: this.client.locationId,
        limit: params.limit ?? 20,
        status: params.unreadOnly ? "unread" : undefined,
      },
    });
  }

  // --- Calendars / Appointments ---
  calendars() {
    return this.request<{ calendars: Calendar[] }>("/calendars/", {
      query: { locationId: this.client.locationId },
    });
  }

  calendarEvents(params: {
    calendarId?: string;
    userId?: string;
    startTime: number;
    endTime: number;
  }) {
    return this.request<{ events: CalendarEvent[] }>("/calendars/events", {
      query: {
        locationId: this.client.locationId,
        calendarId: params.calendarId,
        userId: params.userId,
        startTime: params.startTime,
        endTime: params.endTime,
      },
    });
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// --- Shared response types (only the fields we actually read) ---
export type ContactSummary = {
  id: string;
  firstNameLowerCase?: string;
  lastNameLowerCase?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  dateAdded?: string;
  tags?: string[];
};

export type Pipeline = {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; position: number }>;
};

export type Opportunity = {
  id: string;
  name: string;
  monetaryValue?: number;
  status: "open" | "won" | "lost" | "abandoned" | string;
  pipelineId: string;
  pipelineStageId: string;
  contactId?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Conversation = {
  id: string;
  contactId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  unreadCount?: number;
  lastMessageBody?: string;
  lastMessageType?: string;
  lastMessageDate?: string;
};

export type Calendar = {
  id: string;
  name: string;
  isActive?: boolean;
};

export type CalendarEvent = {
  id: string;
  title?: string;
  contactId?: string;
  calendarId?: string;
  startTime: string;
  endTime: string;
  appointmentStatus?: string;
};
