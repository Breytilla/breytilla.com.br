import { PostEditor } from "@/components/admin/post-editor";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";

export default async function NewPostPage({
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
          <p className={styles.eyebrow}>Blog · novo conteúdo</p>
          <h1>Novo post</h1>
          <p className={styles.pageDescription}>
            Escreva com liberdade e escolha entre manter em rascunho ou publicar.
          </p>
        </div>
      </header>
      <PostEditor accessKey={accessKey} />
    </>
  );
}

