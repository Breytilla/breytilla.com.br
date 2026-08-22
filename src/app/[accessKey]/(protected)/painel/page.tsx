import Link from "next/link";
import {
  BookOpenText,
  FilePenLine,
  Inbox,
  Mail,
  Plus,
  Send,
  Users,
} from "lucide-react";

import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import {
  getDashboardSummary,
  listRecentAuditEvents,
} from "@/server/admin/dashboard";

const eventLabels: Record<string, string> = {
  "post.created": "Novo post criado",
  "post.updated": "Post atualizado",
  "campaign.draft_saved": "Campanha salva como rascunho",
  "campaign.created": "Nova campanha criada",
  "campaign.updated": "Campanha atualizada",
  "campaign.send_claimed": "Envio de campanha iniciado",
  "campaign.sent": "Campanha enviada",
  "session.created": "Novo acesso ao painel",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ accessKey: string }>;
}) {
  const { accessKey } = await params;
  await requireAdminPageSession(accessKey);
  const [summary, events] = await Promise.all([
    getDashboardSummary(),
    listRecentAuditEvents(),
  ]);

  const metrics = [
    { label: "Posts publicados", value: summary.publishedPosts, icon: BookOpenText },
    { label: "Rascunhos", value: summary.draftPosts, icon: FilePenLine },
    { label: "Aptos para envio", value: summary.confirmedSubscribers, icon: Users },
    { label: "Contatos pendentes", value: summary.pendingRequests, icon: Inbox },
  ];

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>Visão geral</p>
          <h1>Olá, Breytilla.</h1>
          <p className={styles.pageDescription}>
            Este é o centro de gestão do blog, da audiência e das suas comunicações.
          </p>
        </div>
        <Link className={styles.primaryButton} href={`/${accessKey}/posts/novo`}>
          <Plus className={styles.buttonIcon} aria-hidden="true" />
          Novo post
        </Link>
      </header>

      <section className={styles.metricsGrid} aria-label="Resumo do painel">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className={styles.metricCard} key={metric.label}>
              <span className={styles.metricIcon}>
                <Icon aria-hidden="true" />
              </span>
              <strong className={styles.metricValue}>{metric.value}</strong>
              <span className={styles.metricLabel}>{metric.label}</span>
            </article>
          );
        })}
      </section>

      <div className={styles.dashboardGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Acesso rápido</h2>
          </div>
          <div className={styles.quickActions}>
            <Link className={styles.quickAction} href={`/${accessKey}/posts/novo`}>
              <Plus aria-hidden="true" />
              <div>
                <strong>Escrever um post</strong>
                <span>Crie e publique um novo conteúdo no blog.</span>
              </div>
            </Link>
            <Link className={styles.quickAction} href={`/${accessKey}/emails/nova`}>
              <Send aria-hidden="true" />
              <div>
                <strong>Nova campanha</strong>
                <span>Prepare uma mensagem para sua audiência.</span>
              </div>
            </Link>
            <Link className={styles.quickAction} href={`/${accessKey}/posts`}>
              <BookOpenText aria-hidden="true" />
              <div>
                <strong>Gerenciar blog</strong>
                <span>Revise rascunhos e posts publicados.</span>
              </div>
            </Link>
            <Link className={styles.quickAction} href={`/${accessKey}/emails`}>
              <Mail aria-hidden="true" />
              <div>
                <strong>Ver campanhas</strong>
                <span>Acompanhe rascunhos e envios anteriores.</span>
              </div>
            </Link>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Atividade recente</h2>
          </div>
          {events.length > 0 ? (
            <ol className={styles.activityList}>
              {events.map((event) => (
                <li className={styles.activityItem} key={event.id}>
                  <strong>{eventLabels[event.action] ?? event.action}</strong>
                  <time dateTime={event.occurredAt.toISOString()}>
                    {dateFormatter.format(event.occurredAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.emptyState}>
              <Inbox aria-hidden="true" />
              <p>As próximas atividades aparecerão aqui.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
