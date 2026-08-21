import { Resend, type WebhookEventPayload } from "resend";

import {
  getMarketingEnv,
  getTransactionalEnv,
  getWebhookEnv,
} from "./env";

let transactionalClient: Resend | undefined;
let marketingClient: Resend | undefined;
let webhookClient: Resend | undefined;

export class EmailProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "EmailProviderError";
  }
}

/** Returns the Resend client scoped to transactional delivery. */
export function getTransactionalResend(): Resend {
  transactionalClient ??= new Resend(
    getTransactionalEnv().RESEND_TRANSACTIONAL_API_KEY,
  );
  return transactionalClient;
}

/** Returns the separately-keyed Resend client used for audience operations. */
export function getMarketingResend(): Resend {
  marketingClient ??= new Resend(getMarketingEnv().RESEND_MARKETING_API_KEY);
  return marketingClient;
}

function getWebhookResend(): Resend {
  webhookClient ??= new Resend();
  return webhookClient;
}

function providerErrorCode(error: {
  name?: string;
  statusCode?: number | null;
}): string {
  const name = error.name?.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
  return `RESEND_${error.statusCode ?? "ERROR"}_${name}`.slice(0, 120);
}

function assertProviderSuccess(
  error: { name?: string; statusCode?: number | null } | null,
): void {
  if (error) {
    throw new EmailProviderError(providerErrorCode(error));
  }
}

/**
 * Creates or updates a confirmed subscriber and applies the configured Topic
 * and Segment in one idempotent operation from the application's perspective.
 */
export async function ensureMarketingSubscriber(input: {
  email: string;
  name?: string | null;
}): Promise<string> {
  const resend = getMarketingResend();
  const { RESEND_MARKETING_TOPIC_ID, RESEND_MARKETING_SEGMENT_ID } =
    getMarketingEnv();

  const existing = await resend.contacts.get({ email: input.email });
  let contactId = existing.data?.id;
  let shouldEnsureMembership = Boolean(existing.data);

  if (existing.error && existing.error.statusCode !== 404) {
    throw new EmailProviderError(providerErrorCode(existing.error));
  }

  if (!contactId) {
    const created = await resend.contacts.create({
      email: input.email,
      ...(input.name ? { firstName: input.name } : {}),
      // A new provider contact starts ineligible. Topic and Segment eligibility
      // are applied below only after the local consent transaction committed.
      unsubscribed: true,
    });

    if (created.error?.statusCode === 409) {
      const racedContact = await resend.contacts.get({ email: input.email });
      assertProviderSuccess(racedContact.error);
      contactId = racedContact.data?.id;
      shouldEnsureMembership = true;
    } else {
      assertProviderSuccess(created.error);
      contactId = created.data?.id;
      shouldEnsureMembership = true;
    }
  }

  if (!contactId) {
    throw new EmailProviderError("RESEND_CONTACT_ID_MISSING");
  }

  if (shouldEnsureMembership) {
    const updated = await resend.contacts.update({
      id: contactId,
      ...(input.name ? { firstName: input.name } : {}),
      unsubscribed: false,
    });
    assertProviderSuccess(updated.error);

    const topics = await resend.contacts.topics.update({
      id: contactId,
      topics: [
        { id: RESEND_MARKETING_TOPIC_ID, subscription: "opt_in" },
      ],
    });
    assertProviderSuccess(topics.error);

    const segment = await resend.contacts.segments.add({
      contactId,
      segmentId: RESEND_MARKETING_SEGMENT_ID,
    });
    if (segment.error && segment.error.statusCode !== 409) {
      throw new EmailProviderError(providerErrorCode(segment.error));
    }
  }

  return contactId;
}

/** Finds a provider contact by address and removes it from the campaign Segment. */
export async function removeEmailFromMarketingSegment(
  email: string,
): Promise<void> {
  const contact = await getMarketingResend().contacts.get({ email });
  if (contact.error?.statusCode === 404) {
    return;
  }
  assertProviderSuccess(contact.error);

  if (contact.data?.id) {
    await removeFromMarketingSegment(contact.data.id);
  }
}

/** Reads the configured marketing Topic state for a Resend contact. */
export async function getMarketingTopicSubscription(
  contactId: string,
): Promise<"opt_in" | "opt_out" | undefined> {
  const response = await getMarketingResend().contacts.topics.list({
    id: contactId,
    limit: 100,
  });
  assertProviderSuccess(response.error);

  const configuredTopicId = getMarketingEnv().RESEND_MARKETING_TOPIC_ID;
  return response.data?.data.find((topic) => topic.id === configuredTopicId)
    ?.subscription;
}

export type MarketingContactState = {
  exists: boolean;
  globallyUnsubscribed: boolean;
  topicSubscription?: "opt_in" | "opt_out";
};

/** Reads global and configured-Topic subscription state from Resend. */
export async function getMarketingContactState(
  contactId: string,
): Promise<MarketingContactState> {
  const resend = getMarketingResend();
  const contact = await resend.contacts.get({ id: contactId });

  if (contact.error?.statusCode === 404) {
    return { exists: false, globallyUnsubscribed: true };
  }
  assertProviderSuccess(contact.error);

  const topicSubscription = await getMarketingTopicSubscription(contactId);
  return {
    exists: true,
    globallyUnsubscribed: contact.data?.unsubscribed ?? true,
    topicSubscription,
  };
}

/** Removes a contact from the configured campaign Segment, tolerating absence. */
export async function removeFromMarketingSegment(
  contactId: string,
): Promise<void> {
  const result = await getMarketingResend().contacts.segments.remove({
    contactId,
    segmentId: getMarketingEnv().RESEND_MARKETING_SEGMENT_ID,
  });

  if (result.error && result.error.statusCode !== 404) {
    throw new EmailProviderError(providerErrorCode(result.error));
  }
}

/** Verifies a raw Resend webhook and returns its typed event payload. */
export function verifyResendWebhook(input: {
  payload: string;
  id: string;
  timestamp: string;
  signature: string;
}): WebhookEventPayload {
  return getWebhookResend().webhooks.verify({
    payload: input.payload,
    headers: {
      id: input.id,
      timestamp: input.timestamp,
      signature: input.signature,
    },
    webhookSecret: getWebhookEnv().RESEND_WEBHOOK_SECRET,
  });
}
