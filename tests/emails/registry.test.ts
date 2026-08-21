import { describe, expect, it } from "vitest";

import {
  emailTemplateRegistry,
  marketingEmailTemplates,
  transactionalEmailTemplates,
} from "@/emails";

describe("emailTemplateRegistry", () => {
  it("mantém templates transacionais e de marketing em streams distintos", () => {
    expect(Object.keys(transactionalEmailTemplates).sort()).toEqual([
      "contact-request-internal",
      "contact-request-received",
      "newsletter-confirm-opt-in",
    ]);
    expect(Object.keys(marketingEmailTemplates)).toEqual(["newsletter"]);

    const transactionalNames = new Set(
      Object.keys(transactionalEmailTemplates),
    );
    const overlaps = Object.keys(marketingEmailTemplates).filter((name) =>
      transactionalNames.has(name),
    );

    expect(overlaps).toEqual([]);
    expect(emailTemplateRegistry.transactional).toBe(
      transactionalEmailTemplates,
    );
    expect(emailTemplateRegistry.marketing).toBe(marketingEmailTemplates);
  });
});
