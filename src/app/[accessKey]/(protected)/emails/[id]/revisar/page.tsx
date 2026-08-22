import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { CampaignSendForm } from "@/components/admin/campaign-send-form";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import { getCampaignById } from "@/server/admin/campaigns";

export default async function ReviewCampaignPage({
  params,
}: {
  params: Promise<{ accessKey: string; id: string }>;
}) {
  const { accessKey, id } = await params;
  await requireAdminPageSession(accessKey);
  const campaign = await getCampaignById(id);
  if (!campaign || campaign.status !== "draft" || !campaign.content) {
    notFound();
  }

  const paragraphs = campaign.content.body
    .split(/\r?\n(?:[ \t]*\r?\n)+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>E-mail marketing · revisão final</p>
          <h1>Revise antes de enviar.</h1>
          <p className={styles.pageDescription}>
            Esta é a última versão salva e sincronizada com o Resend.
          </p>
        </div>
        <Link className={styles.secondaryButton} href={`/${accessKey}/emails/${id}`}>
          <ArrowLeft className={styles.buttonIcon} aria-hidden="true" />
          Voltar e editar
        </Link>
      </header>

      <div className={styles.dashboardGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Conteúdo salvo</h2>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
              <ShieldCheck aria-hidden="true" /> Sincronizado
            </span>
          </div>
          <div className={styles.campaignReview}>
            <dl className={styles.reviewMeta}>
              <div>
                <dt>Nome interno</dt>
                <dd>{campaign.name}</dd>
              </div>
              <div>
                <dt>Assunto</dt>
                <dd>{campaign.subject}</dd>
              </div>
              <div>
                <dt>Texto de prévia</dt>
                <dd>{campaign.preheader}</dd>
              </div>
            </dl>

            <article className={styles.reviewMessage}>
              <small>Conteúdos e novidades</small>
              <h2>{campaign.content.title}</h2>
              <p>{campaign.content.intro}</p>
              <h3>{campaign.content.sectionHeading}</h3>
              {(paragraphs.length > 0 ? paragraphs : [campaign.content.body]).map(
                (paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 30)}`}>{paragraph}</p>
                ),
              )}
              {campaign.content.cta ? (
                <span className={styles.reviewCta}>{campaign.content.cta.label}</span>
              ) : null}
            </article>
          </div>
        </section>

        <aside>
          <CampaignSendForm
            accessKey={accessKey}
            campaignId={campaign.id}
            expectedUpdatedAt={campaign.updatedAt.toISOString()}
          />
        </aside>
      </div>
    </>
  );
}
