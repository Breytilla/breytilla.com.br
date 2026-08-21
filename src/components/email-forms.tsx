"use client";

import { type FormEvent, useState } from "react";

const CONSENT_VERSION = "2026-08-20";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

type SubmissionState = {
  status: SubmissionStatus;
  message: string;
};

const initialState: SubmissionState = {
  status: "idle",
  message: "",
};

function readString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

async function postForm(endpoint: string, payload: Record<string, unknown>) {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Não foi possível se conectar agora. Verifique sua internet e tente novamente.",
    );
  }

  if (response.ok) {
    return;
  }

  if (response.status === 429) {
    throw new Error(
      "Foram feitas muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  }

  throw new Error(
    "Não foi possível concluir o envio agora. Tente novamente em alguns instantes.",
  );
}

export function ContactForm() {
  const [submission, setSubmission] =
    useState<SubmissionState>(initialState);
  const isSubmitting = submission.status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const phone = readString(formData, "phone");
    const preferredChannelValue = readString(
      formData,
      "preferredChannel",
    );

    if (preferredChannelValue === "whatsapp" && !phone) {
      setSubmission({
        status: "error",
        message: "Informe um telefone para receber a resposta pelo WhatsApp.",
      });
      return;
    }

    setSubmission({
      status: "submitting",
      message: "Enviando seu contato…",
    });

    try {
      await postForm("/api/contact", {
        name: readString(formData, "name"),
        email: readString(formData, "email"),
        ...(phone ? { phone } : {}),
        preferredChannel:
          preferredChannelValue === "whatsapp" ? "whatsapp" : "email",
        marketingOptIn: formData.get("marketingOptIn") === "true",
        consentVersion: CONSENT_VERSION,
        website: readString(formData, "website"),
      });

      form.reset();
      setSubmission({
        status: "success",
        message:
          "Seu contato foi enviado. Vou responder pelo canal escolhido assim que possível.",
      });
    } catch (error) {
      setSubmission({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar seu contato. Tente novamente.",
      });
    }
  }

  return (
    <div className="contact-form-card">
      <div className="email-form-intro">
        <p className="email-form-kicker">Outro canal de contato</p>
        <h3 id="contact-form-title">Prefere escrever por aqui?</h3>
        <p>
          Envie apenas seus dados de contato. Para cuidar da sua privacidade,
          não compartilhe informações sensíveis ou detalhes clínicos.
        </p>
      </div>

      <form
        className="email-form email-form--contact"
        aria-labelledby="contact-form-title"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="email-form-field">
          <label htmlFor="contact-name">Nome</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={100}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="email-form-field">
          <label htmlFor="contact-email">E-mail</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="email-form-field">
          <label htmlFor="contact-phone">
            Telefone ou WhatsApp <span>(opcional)</span>
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={30}
            placeholder="(00) 00000-0000"
            disabled={isSubmitting}
          />
        </div>

        <fieldset className="email-form-options" disabled={isSubmitting}>
          <legend>Como prefere receber a resposta?</legend>
          <div className="email-form-options-list">
            <label className="email-choice" htmlFor="reply-email">
              <input
                id="reply-email"
                name="preferredChannel"
                type="radio"
                value="email"
                defaultChecked
              />
              <span>E-mail</span>
            </label>
            <label className="email-choice" htmlFor="reply-whatsapp">
              <input
                id="reply-whatsapp"
                name="preferredChannel"
                type="radio"
                value="whatsapp"
              />
              <span>WhatsApp</span>
            </label>
          </div>
        </fieldset>

        <label className="email-checkbox" htmlFor="contact-marketing-opt-in">
          <input
            id="contact-marketing-opt-in"
            name="marketingOptIn"
            type="checkbox"
            value="true"
            disabled={isSubmitting}
          />
          <span>
            Também quero receber conteúdos e novidades por e-mail. A inscrição
            só será concluída depois da minha confirmação. Consulte o{" "}
            <a href="/privacidade">Aviso de Privacidade</a>.
          </span>
        </label>

        <div className="email-honeypot" aria-hidden="true">
          <label htmlFor="contact-website">Não preencha este campo</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        <button
          className="button button--primary email-form-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Enviando…" : "Enviar meu contato"}
        </button>

        <p
          className="email-form-feedback"
          data-status={submission.status}
          aria-live="polite"
          aria-atomic="true"
        >
          {submission.message}
        </p>
      </form>
    </div>
  );
}

export function NewsletterForm() {
  const [submission, setSubmission] =
    useState<SubmissionState>(initialState);
  const isSubmitting = submission.status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = readString(formData, "firstName");
    const marketingConsent =
      formData.get("marketingConsent") === "true";

    if (!marketingConsent) {
      setSubmission({
        status: "error",
        message: "Confirme que deseja receber os conteúdos por e-mail.",
      });
      return;
    }

    setSubmission({
      status: "submitting",
      message: "Registrando sua inscrição…",
    });

    try {
      await postForm("/api/newsletter", {
        ...(firstName ? { firstName } : {}),
        email: readString(formData, "email"),
        consentVersion: CONSENT_VERSION,
        website: readString(formData, "website"),
        marketingConsent: true,
      });

      form.reset();
      setSubmission({
        status: "success",
        message:
          "Quase lá: confira sua caixa de entrada e confirme sua inscrição.",
      });
    } catch (error) {
      setSubmission({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível registrar sua inscrição. Tente novamente.",
      });
    }
  }

  return (
    <section className="newsletter-panel" aria-labelledby="newsletter-title">
      <div className="newsletter-copy">
        <p className="email-form-kicker">Conteúdos e novidades</p>
        <h2 id="newsletter-title">Um convite para continuar essa conversa.</h2>
        <p>
          Receba reflexões sobre autocuidado, relações e presença. Sem excesso
          de mensagens e com liberdade para sair quando quiser.
        </p>
      </div>

      <form
        className="email-form email-form--newsletter"
        aria-labelledby="newsletter-title"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="newsletter-fields">
          <div className="email-form-field">
            <label htmlFor="newsletter-first-name">
              Primeiro nome <span>(opcional)</span>
            </label>
            <input
              id="newsletter-first-name"
              name="firstName"
              type="text"
              autoComplete="given-name"
              maxLength={100}
              disabled={isSubmitting}
            />
          </div>

          <div className="email-form-field">
            <label htmlFor="newsletter-email">E-mail</label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <label className="email-checkbox" htmlFor="newsletter-consent">
          <input
            id="newsletter-consent"
            name="marketingConsent"
            type="checkbox"
            value="true"
            required
            disabled={isSubmitting}
          />
          <span>
            Quero receber conteúdos e novidades por e-mail e entendo que
            precisarei confirmar minha inscrição. Li o{" "}
            <a href="/privacidade">Aviso de Privacidade</a>.
          </span>
        </label>

        <div className="email-honeypot" aria-hidden="true">
          <label htmlFor="newsletter-website">Não preencha este campo</label>
          <input
            id="newsletter-website"
            name="website"
            type="text"
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        <button
          className="button button--light email-form-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Inscrevendo…" : "Quero receber"}
        </button>

        <p
          className="email-form-feedback"
          data-status={submission.status}
          aria-live="polite"
          aria-atomic="true"
        >
          {submission.message}
        </p>
      </form>
    </section>
  );
}
