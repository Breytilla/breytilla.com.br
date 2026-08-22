"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, Save } from "lucide-react";

import {
  initialAdminActionState,
  savePostAction,
} from "@/app/[accessKey]/actions";
import styles from "./admin.module.css";
import { useUnsavedChanges } from "./use-unsaved-changes";

export type EditablePost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  status: "draft" | "published" | "archived";
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
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

export function PostEditor({
  accessKey,
  post,
}: {
  accessKey: string;
  post?: EditablePost;
}) {
  const boundAction = savePostAction.bind(null, accessKey);
  const [state, action, pending] = useActionState(
    boundAction,
    initialAdminActionState,
  );
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(post?.slug));
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    post?.status ?? "draft",
  );
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
      onSubmit={(event) => {
        if (
          status === "published" &&
          post?.status !== "published" &&
          !window.confirm("Publicar este post no blog agora?")
        ) {
          event.preventDefault();
          return;
        }
        setDirty(false);
      }}
    >
      <input name="id" type="hidden" value={post?.id ?? ""} />
      <input name="version" type="hidden" value={post?.updatedAt ?? ""} />

      {state.status === "error" && state.message ? (
        <p className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}

      <div className={styles.editorGrid}>
        <div>
          <section className={styles.formSection}>
            <h2>Conteúdo do post</h2>
            <div className={styles.formStack}>
              <div className={styles.field}>
                <label htmlFor="post-title">Título</label>
                <input
                  className={styles.input}
                  id="post-title"
                  name="title"
                  value={title}
                  onChange={(event) => {
                    const nextTitle = event.target.value;
                    setTitle(nextTitle);
                    if (!slugWasEdited) {
                      setSlug(slugify(nextTitle));
                    }
                  }}
                  maxLength={140}
                  placeholder="Ex.: O que a ansiedade tenta comunicar?"
                  required
                  {...accessibilityFor("title")}
                />
                {errorFor("title")}
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label htmlFor="post-slug">Endereço do post</label>
                  <input
                    className={styles.input}
                    id="post-slug"
                    name="slug"
                    value={slug}
                    onChange={(event) => {
                      setSlug(slugify(event.target.value));
                      setSlugWasEdited(Boolean(event.target.value));
                    }}
                    maxLength={160}
                    placeholder="gerado-a-partir-do-titulo"
                    {...accessibilityFor("slug")}
                  />
                  <p className={styles.fieldHint}>breytilla.com.br/blog/{slug || "seu-post"}</p>
                  {errorFor("slug")}
                </div>

                <div className={styles.field}>
                  <label htmlFor="post-category">Categoria</label>
                  <input
                    className={styles.input}
                    id="post-category"
                    name="category"
                    defaultValue={post?.category ?? "Reflexões"}
                    maxLength={60}
                    placeholder="Reflexões"
                    required
                    {...accessibilityFor("category")}
                  />
                  {errorFor("category")}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="post-excerpt">Resumo</label>
                <textarea
                  className={styles.textarea}
                  id="post-excerpt"
                  name="excerpt"
                  defaultValue={post?.excerpt ?? ""}
                  maxLength={320}
                  placeholder="Uma apresentação breve que convida à leitura."
                  required
                  {...accessibilityFor("excerpt")}
                />
                <p className={styles.fieldHint}>Aparece na página inicial do blog e nos resultados de busca.</p>
                {errorFor("excerpt")}
              </div>

              <div className={styles.field}>
                <label htmlFor="post-content">Texto</label>
                <textarea
                  className={`${styles.textarea} ${styles.contentTextarea}`}
                  id="post-content"
                  name="content"
                  defaultValue={post?.content ?? ""}
                  maxLength={50_000}
                  placeholder={
                    "Escreva o conteúdo aqui.\n\nUse uma linha em branco para começar um novo parágrafo."
                  }
                  required
                  {...accessibilityFor("content")}
                />
                <p className={styles.fieldHint}>O texto é tratado como conteúdo seguro. Separe parágrafos com uma linha em branco.</p>
                {errorFor("content")}
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>Busca e compartilhamento</h2>
            <div className={styles.formStack}>
              <div className={styles.field}>
                <label htmlFor="post-seo-title">Título para buscadores</label>
                <input
                  className={styles.input}
                  id="post-seo-title"
                  name="seoTitle"
                  defaultValue={post?.seoTitle ?? ""}
                  maxLength={70}
                  placeholder="Se vazio, usa o título do post"
                  {...accessibilityFor("seoTitle")}
                />
                {errorFor("seoTitle")}
              </div>
              <div className={styles.field}>
                <label htmlFor="post-seo-description">Descrição para buscadores</label>
                <textarea
                  className={styles.textarea}
                  id="post-seo-description"
                  name="seoDescription"
                  defaultValue={post?.seoDescription ?? ""}
                  maxLength={170}
                  placeholder="Se vazia, usa o resumo do post"
                  {...accessibilityFor("seoDescription")}
                />
                {errorFor("seoDescription")}
              </div>
            </div>
          </section>
        </div>

        <aside className={styles.sidebarPanel}>
          <section className={styles.formSection}>
            <h2>Publicação</h2>
            <div className={styles.formStack}>
              <div className={styles.field}>
                <label htmlFor="post-status">Status</label>
                <select
                  className={styles.select}
                  id="post-status"
                  name="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as "draft" | "published" | "archived",
                    )
                  }
                  {...accessibilityFor("status")}
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </select>
                <p className={styles.fieldHint}>Rascunhos nunca aparecem no site público.</p>
              </div>

              <div className={styles.divider} />

              <div className={styles.actionStack}>
                <button className={styles.primaryButton} type="submit" disabled={pending}>
                  {pending ? (
                    <LoaderCircle className={styles.buttonIcon} aria-hidden="true" />
                  ) : (
                    <Save className={styles.buttonIcon} aria-hidden="true" />
                  )}
                  {pending
                    ? "Salvando"
                    : status === "archived"
                      ? "Arquivar post"
                      : status === "published"
                      ? post?.status === "published"
                        ? "Atualizar publicação"
                        : "Publicar post"
                      : "Salvar rascunho"}
                </button>

                <Link className={styles.ghostButton} href={`/${accessKey}/posts`}>
                  Cancelar
                </Link>

                {post?.status === "published" ? (
                  <Link
                    className={styles.secondaryButton}
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ver post no site (abre em nova aba)"
                  >
                    <ExternalLink className={styles.buttonIcon} aria-hidden="true" />
                    Ver no site
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
