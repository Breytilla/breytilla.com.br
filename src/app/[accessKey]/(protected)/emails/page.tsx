import Link from "next/link";
import { Mail, Plus } from "lucide-react";

import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import { listCampaigns } from "@/server/admin/campaigns";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const statusLabels = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  cancelled: "Cancelada",
  failed: "Falhou",
};

function campaignBadgeClass(status: keyof typeof statusLabels): string {
  if (status === "sent") return styles.badgeSuccess;
  if (status === "failed") return styles.badgeDanger;
  if (status === "sending" || status === "scheduled") return styles.badgeWarning;
  if (status === "cancelled") return styles.badgeMuted;
  return "";
}

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accessKey: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { accessKey } = await params;
  await requireAdminPageSession(accessKey);
  const [campaigns, query] = await Promise.all([listCampaigns(), searchParams]);

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>Comunicação</p>
          <h1>E-mail marketing</h1>
          <p className={styles.pageDescription}>
            Prepare campanhas editoriais e envie somente para assinantes confirmados.
          </p>
        </div>
        <Link className={styles.primaryButton} href={`/${accessKey}/emails/nova`}>
          <Plus className={styles.buttonIcon} aria-hidden="true" />
          Nova campanha
        </Link>
      </header>

      {query.salvo === "1" ? (
        <p className={styles.notice} role="status">
          Rascunho salvo e sincronizado com o Resend.
        </p>
      ) : null}

      {campaigns.length > 0 ? (
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Lista de campanhas"
          tabIndex={0}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Assunto</th>
                <th>Status</th>
                <th>Atualização</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <span className={styles.tableTitle}>{campaign.name}</span>
                    <span className={styles.tableMeta}>{campaign.campaignKey}</span>
                  </td>
                  <td>{campaign.subject}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${campaignBadgeClass(campaign.status)}`}
                    >
                      {statusLabels[campaign.status]}
                    </span>
                  </td>
                  <td>{dateFormatter.format(campaign.updatedAt)}</td>
                  <td>
                    <Link className={styles.rowLink} href={`/${accessKey}/emails/${campaign.id}`}>
                      {campaign.status === "draft" ? "Editar" : "Detalhes"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`${styles.panel} ${styles.emptyState}`}>
          <Mail aria-hidden="true" />
          <p>Nenhuma campanha criada até o momento.</p>
        </div>
      )}
    </>
  );
}
