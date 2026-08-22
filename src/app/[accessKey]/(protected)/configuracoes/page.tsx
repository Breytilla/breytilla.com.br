import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";

import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accessKey: string }>;
  searchParams: Promise<{ logout?: string }>;
}) {
  const { accessKey } = await params;
  await requireAdminPageSession(accessKey);
  const query = await searchParams;

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>Configurações</p>
          <h1>Segurança e operação</h1>
          <p className={styles.pageDescription}>
            Um resumo das proteções ativas. Segredos nunca são exibidos neste painel.
          </p>
        </div>
      </header>

      {query.logout === "erro" ? (
        <p className={styles.formMessage} role="alert">
          Não foi possível revogar a sessão no servidor. Sua sessão continua ativa;
          tente sair novamente em alguns instantes.
        </p>
      ) : null}

      <div className={styles.dashboardGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Acesso administrativo</h2>
          </div>
          <ol className={styles.activityList}>
            <li className={styles.activityItem}>
              <strong><ShieldCheck aria-hidden="true" /> Sessão privada e revogável</strong>
              <span className={styles.activityDetail}>Expiração absoluta de 8 horas, com revogação no logout.</span>
            </li>
            <li className={styles.activityItem}>
              <strong><KeyRound aria-hidden="true" /> Senha armazenada como hash</strong>
              <span className={styles.activityDetail}>A senha original nunca é salva no banco ou no código.</span>
            </li>
            <li className={styles.activityItem}>
              <strong><CheckCircle2 aria-hidden="true" /> Proteção contra tentativas</strong>
              <span className={styles.activityDetail}>Bloqueio temporário persistido e trilha de auditoria.</span>
            </li>
          </ol>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Importante</h2>
          </div>
          <div className={styles.emptyState}>
            <ShieldCheck aria-hidden="true" />
            <p>
              A palavra usada no endereço torna a entrada discreta, mas a senha e a sessão são as barreiras reais de segurança.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
