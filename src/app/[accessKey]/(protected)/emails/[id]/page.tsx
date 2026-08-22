import { notFound } from "next/navigation";

import { CampaignEditor } from "@/components/admin/campaign-editor";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import { getCampaignById } from "@/server/admin/campaigns";

const statusLabels = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Envio em verificação",
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

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ accessKey: string; id: string }>;
}) {
  const { accessKey, id } = await params;
  await requireAdminPageSession(accessKey);
  const campaign = await getCampaignById(id);
  if (!campaign) {
    notFound();
  }

  const content = campaign.content;

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>E-mail marketing · {statusLabels[campaign.status]}</p>
          <h1>{campaign.status === "draft" ? "Editar campanha" : "Detalhes da campanha"}</h1>
          <p className={styles.pageDescription}>{campaign.name}</p>
        </div>
        <span
          className={`${styles.badge} ${campaignBadgeClass(campaign.status)}`}
        >
          {statusLabels[campaign.status]}
        </span>
      </header>

      {campaign.status === "draft" ? (
        <CampaignEditor
          accessKey={accessKey}
          campaign={{
            id: campaign.id,
            campaignKey: campaign.campaignKey,
            name: campaign.name,
            subject: campaign.subject,
            preheader: campaign.preheader,
            title: content?.title ?? campaign.subject,
            intro: content?.intro ?? "",
            sectionHeading: content?.sectionHeading ?? "Uma reflexão para a semana",
            body: content?.body ?? "",
            ctaLabel: content?.cta?.label ?? "",
            ctaUrl: content?.cta?.url ?? "",
          }}
        />
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Resumo</h2>
          </div>
          <ol className={styles.activityList}>
            <li className={styles.activityItem}>
              <strong>Assunto</strong>
              <span className={styles.activityDetail}>{campaign.subject}</span>
            </li>
            <li className={styles.activityItem}>
              <strong>Prévia</strong>
              <span className={styles.activityDetail}>{campaign.preheader}</span>
            </li>
            <li className={styles.activityItem}>
              <strong>Identificador</strong>
              <span className={styles.activityDetail}>{campaign.campaignKey}</span>
            </li>
          </ol>
        </section>
      )}
    </>
  );
}
