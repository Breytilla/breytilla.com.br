"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BookOpenText,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  Users,
} from "lucide-react";

import { logoutAdminAction } from "@/app/[accessKey]/actions";
import styles from "./admin.module.css";

const navigation = [
  { suffix: "/painel", label: "Visão geral", icon: LayoutDashboard },
  { suffix: "/posts", label: "Blog", icon: BookOpenText },
  { suffix: "/emails", label: "E-mail marketing", icon: Mail },
  { suffix: "/contatos", label: "Contatos", icon: Users },
  { suffix: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminShell({
  accessKey,
  displayName,
  children,
}: {
  accessKey: string;
  displayName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const basePath = `/${accessKey}`;
  const logout = logoutAdminAction.bind(null, accessKey);

  return (
    <div className={styles.adminShell}>
      <a className={styles.adminSkipLink} href="#admin-content">
        Ir para o conteúdo
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <Link className={styles.brandWordmark} href={`${basePath}/painel`}>
            Brey<em>tilla</em>
          </Link>
          <p>Área de gestão</p>
        </div>

        <nav className={styles.sidebarNav} aria-label="Navegação administrativa">
          {navigation.map((item) => {
            const href = `${basePath}${item.suffix}`;
            const active =
              pathname === href ||
              (item.suffix !== "/painel" && pathname.startsWith(`${href}/`));
            const Icon = item.icon;
            return (
              <Link
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                href={href}
                key={item.suffix}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link
            className={styles.siteLink}
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visualizar site (abre em nova aba)"
          >
            <ExternalLink aria-hidden="true" />
            Visualizar site
          </Link>
          <form action={logout}>
            <button className={styles.logoutButton} type="submit">
              <LogOut aria-hidden="true" />
              Sair com segurança
            </button>
          </form>
        </div>
      </aside>

      <div className={styles.adminBody}>
        <header className={styles.topbar}>
          <span className={styles.topbarContext}>Gestão do site e conteúdo</span>
          <div className={styles.profile}>
            <span className={styles.avatar} aria-hidden="true">
              {displayName.charAt(0).toLocaleUpperCase("pt-BR")}
            </span>
            <span>{displayName}</span>
          </div>
          <form className={styles.mobileLogout} action={logout}>
            <button type="submit" aria-label="Sair com segurança">
              <LogOut aria-hidden="true" />
              <span>Sair</span>
            </button>
          </form>
        </header>
        <main className={styles.adminMain} id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
