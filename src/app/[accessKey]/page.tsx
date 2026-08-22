import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/login-form";
import styles from "@/components/admin/admin.module.css";
import { getAdminSession, isAdminRouteKey } from "@/server/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ accessKey: string }>;
}) {
  const { accessKey } = await params;
  if (!isAdminRouteKey(accessKey)) {
    notFound();
  }

  const session = await getAdminSession(accessKey);
  if (session) {
    redirect(`/${accessKey}/painel`);
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginBrand} aria-label="Breytilla — área privada">
        <div className={styles.orbit} aria-hidden="true" />
        <div className={styles.orbitSecond} aria-hidden="true" />

        <div className={styles.brandTop}>
          <span className={styles.brandWordmark}>
            Brey<em>tilla</em>
          </span>
        </div>

        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>Gestão com presença</p>
          <h1>
            Seu conteúdo, <em>em um só lugar.</em>
          </h1>
          <p>
            Organize as publicações do blog, acompanhe contatos e prepare suas
            comunicações com tranquilidade.
          </p>
        </div>

        <p className={styles.brandFoot}>
          <span aria-hidden="true" />
          Ambiente privado e seguro
        </p>
      </section>

      <section className={styles.loginContent}>
        <div className={styles.loginCard}>
          <Link className={styles.backLink} href="/">
            <ArrowLeft aria-hidden="true" />
            Voltar ao site
          </Link>

          <div className={styles.loginHeading}>
            <p className={styles.eyebrow}>Área de gestão</p>
            <h2>Bem-vinda de volta.</h2>
            <p>Use suas credenciais para acessar o painel administrativo.</p>
          </div>

          <AdminLoginForm accessKey={accessKey} />
        </div>
      </section>
    </main>
  );
}

