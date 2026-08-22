import Link from "next/link";
import { BookOpenText, Plus } from "lucide-react";

import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import { listAdminPosts } from "@/server/admin/posts";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const statusLabels = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accessKey: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { accessKey } = await params;
  await requireAdminPageSession(accessKey);
  const [posts, query] = await Promise.all([listAdminPosts(), searchParams]);

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>Conteúdo</p>
          <h1>Blog</h1>
          <p className={styles.pageDescription}>
            Crie textos com calma, salve rascunhos e publique quando estiver pronto.
          </p>
        </div>
        <Link className={styles.primaryButton} href={`/${accessKey}/posts/novo`}>
          <Plus className={styles.buttonIcon} aria-hidden="true" />
          Novo post
        </Link>
      </header>

      {query.salvo === "1" ? (
        <p className={styles.notice} role="status">
          Post salvo com sucesso.
        </p>
      ) : null}

      {posts.length > 0 ? (
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Lista de posts"
          tabIndex={0}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Post</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Atualização</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <span className={styles.tableTitle}>{post.title}</span>
                    <span className={styles.tableMeta}>/blog/{post.slug}</span>
                  </td>
                  <td>{post.category}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        post.status === "published" ? styles.badgeSuccess : styles.badgeMuted
                      }`}
                    >
                      {statusLabels[post.status]}
                    </span>
                  </td>
                  <td>{dateFormatter.format(post.updatedAt)}</td>
                  <td>
                    <Link className={styles.rowLink} href={`/${accessKey}/posts/${post.id}`}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`${styles.panel} ${styles.emptyState}`}>
          <BookOpenText aria-hidden="true" />
          <p>Você ainda não criou nenhum post.</p>
        </div>
      )}
    </>
  );
}
