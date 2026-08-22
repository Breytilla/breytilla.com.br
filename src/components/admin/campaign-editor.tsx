"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";

import { saveCampaignAction } from "@/app/[accessKey]/campaign-actions";
import { initialAdminActionState } from "@/app/[accessKey]/actions";
import styles from "./admin.module.css";
import { useUnsavedChanges } from "./use-unsaved-changes";

export type EditableCampaign = {
  id: string;
  campaignKey: string;
  name: string;
  subject: string;
  preheader: string;
  title: string;
  intro: string;
  sectionHeading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/g, "");
}

export function CampaignEditor({
  accessKey,
  campaign,
}: {
  accessKey: string;
  campaign?: EditableCampaign;
}) {
  const boundAction = saveCampaignAction.bind(null, accessKey);
  const [state, action, pending] = useActionState(
    boundAction,
    initialAdminActionState,
  );
  const [name, setName] = useState(campaign?.name ?? "");
  const [campaignKey, setCampaignKey] = useState(campaign?.campaignKey ?? "");
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [intro, setIntro] = useState(campaign?.intro ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [keyWasEdited, setKeyWasEdited] = useState(Boolean(campaign));
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hasValidationErrors =
    state.status === "error" && Boolean(state.fieldErrors);
  useUnsavedChanges(dirty || hasValidationErrors);

  useEffect(() => {
    if (hasValidationErrors) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
  }, [hasValidationErrors, state]);

  function errorFor(field: string) {
    const error = state.fieldErrors?.[field]?.[0];
    return error ? (
      <p className={styles.fieldError} id={`${field}-error`}>
        {error}
      </p>
    ) : null;
  }

  function accessibilityFor(field: string) {
    const invalid = Boolean(state.fieldErrors?.[field]?.length);
    return {
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${field}-error` : undefined,
    };
  }

  return (
    <form
      action={action}
      ref={formRef}
      noValidate
      onChangeCapture={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
    >
      <input name="id" type="hidden" value={campaign?.id ?? ""} />
      {state.status === "error" && state.message ? (
        <p className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}

      <div className={styles.editorGrid}>
        <div>
          <section className={styles.formSection}>
            <h2>Identificação</h2>
            <div className={styles.formStack}>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="campaign-name">Nome interno</label>
                  <input
                    className={styles.input}
                    id="campaign-name"
                    name="name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!campaign && !keyWasEdited) {
                        setCampaignKey(slugify(event.target.value));
                      }
                    }}
                    maxLength={160}
                    placeholder="Newsletter · Setembro"
                    required
                    {...accessibilityFor("name")}
                  />
                  {errorFor("name")}
                </div>
                <div className={styles.field}>
                  <label htmlFor="campaign-key">Identificador</label>
                  <input
                    className={styles.input}
                    id="campaign-key"
                    name="campaignKey"
                    value={campaignKey}
                    onChange={(event) => {
                      setCampaignKey(slugify(event.target.value));
                      setKeyWasEdited(Boolean(event.target.value));
                    }}
                    maxLength={160}
                    readOnly={Boolean(campaign)}
                    required
                    {...accessibilityFor("campaignKey")}
                  />
                  {errorFor("campaignKey")}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="campaign-subject">Assunto do e-mail</label>
                <input
                  className={styles.input}
                  id="campaign-subject"
                  name="subject"
                  defaultValue={campaign?.subject ?? ""}
                  maxLength={200}
                  placeholder="Uma pausa para voltar ao presente"
                  required
                  {...accessibilityFor("subject")}
                />
                {errorFor("subject")}
              </div>
              <div className={styles.field}>
                <label htmlFor="campaign-preheader">Texto de prévia</label>
                <input
                  className={styles.input}
                  id="campaign-preheader"
                  name="preheader"
                  defaultValue={campaign?.preheader ?? ""}
                  maxLength={240}
                  placeholder="A frase curta exibida ao lado do assunto na caixa de entrada."
                  required
                  {...accessibilityFor("preheader")}
                />
                {errorFor("preheader")}
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>Mensagem</h2>
            <div className={styles.formStack}>
              <div className={styles.field}>
                <label htmlFor="campaign-title">Título principal</label>
                <input
                  className={styles.input}
                  id="campaign-title"
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={240}
                  required
                  {...accessibilityFor("title")}
                />
                {errorFor("title")}
              </div>
              <div className={styles.field}>
                <label htmlFor="campaign-intro">Introdução</label>
                <textarea
                  className={styles.textarea}
                  id="campaign-intro"
                  name="intro"
                  value={intro}
                  onChange={(event) => setIntro(event.target.value)}
                  maxLength={2_000}
                  required
                  {...accessibilityFor("intro")}
                />
                {errorFor("intro")}
              </div>
              <div className={styles.field}>
                <label htmlFor="campaign-section">Título da seção</label>
                <input
                  className={styles.input}
                  id="campaign-section"
                  name="sectionHeading"
                  defaultValue={campaign?.sectionHeading ?? "Uma reflexão para a semana"}
                  maxLength={200}
                  required
                  {...accessibilityFor("sectionHeading")}
                />
                {errorFor("sectionHeading")}
              </div>
              <div className={styles.field}>
                <label htmlFor="campaign-body">Corpo do e-mail</label>
                <textarea
                  className={`${styles.textarea} ${styles.contentTextarea}`}
                  id="campaign-body"
                  name="body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={50_000}
                  placeholder="Separe os parágrafos com uma linha em branco."
                  required
                  {...accessibilityFor("body")}
                />
                {errorFor("body")}
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>Chamada para ação · opcional</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="campaign-cta-label">Texto do botão</label>
                <input
                  className={styles.input}
                  id="campaign-cta-label"
                  name="ctaLabel"
                  defaultValue={campaign?.ctaLabel ?? ""}
                  maxLength={100}
                  placeholder="Ler no blog"
                  {...accessibilityFor("ctaLabel")}
                />
                {errorFor("ctaLabel")}
              </div>
              <div className={styles.field}>
                <label htmlFor="campaign-cta-url">URL do botão</label>
                <input
                  className={styles.input}
                  id="campaign-cta-url"
                  name="ctaUrl"
                  type="url"
                  defaultValue={campaign?.ctaUrl ?? ""}
                  maxLength={2_048}
                  placeholder="https://breytilla.com.br/blog/..."
                  {...accessibilityFor("ctaUrl")}
                />
                {errorFor("ctaUrl")}
              </div>
            </div>
          </section>
        </div>

        <aside className={styles.sidebarPanel}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>Prévia do conteúdo</div>
            <div className={styles.emailPreview}>
              <small>Conteúdos e novidades</small>
              <h3>{title || "Título da sua mensagem"}</h3>
              <p>{intro || "A introdução da campanha aparecerá aqui."}</p>
              <p>{body ? `${body.slice(0, 220)}${body.length > 220 ? "…" : ""}` : "Comece a escrever para visualizar o conteúdo."}</p>
            </div>
          </div>

          <section className={styles.formSection}>
            <h2>Rascunho</h2>
            <div className={styles.actionStack}>
              <button className={styles.primaryButton} type="submit" disabled={pending}>
                {pending ? (
                  <LoaderCircle className={styles.buttonIcon} aria-hidden="true" />
                ) : (
                  <Save className={styles.buttonIcon} aria-hidden="true" />
                )}
                {pending ? "Sincronizando" : "Salvar no Resend"}
              </button>
              <Link className={styles.ghostButton} href={`/${accessKey}/emails`}>
                Cancelar
              </Link>
              {campaign ? (
                <>
                  <div className={styles.divider} />
                  <Link
                    className={styles.secondaryButton}
                    href={`/${accessKey}/emails/${campaign.id}/revisar`}
                  >
                    <CheckCircle2 className={styles.buttonIcon} aria-hidden="true" />
                    Revisar versão salva
                  </Link>
                  <p className={styles.fieldHint}>
                    Salve as mudanças antes de abrir a revisão para envio.
                  </p>
                </>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
