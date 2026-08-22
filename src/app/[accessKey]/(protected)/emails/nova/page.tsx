import { CampaignEditor } from "@/components/admin/campaign-editor";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ accessKey: string }>;
}) {
  const { accessKey } = await params;
  await requireAdminPageSession(accessKey);

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>E-mail marketing · novo rascunho</p>
          <h1>Nova campanha</h1>
          <p className={styles.pageDescription}>
            Escreva a mensagem e salve no Resend. O envio só fica disponível depois da revisão.
          </p>
        </div>
      </header>
      <CampaignEditor accessKey={accessKey} />
    </>
  );
}

