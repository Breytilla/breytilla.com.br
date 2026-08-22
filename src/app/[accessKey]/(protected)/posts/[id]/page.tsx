import { notFound } from "next/navigation";

import { PostEditor } from "@/components/admin/post-editor";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import { getAdminPostById } from "@/server/admin/posts";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ accessKey: string; id: string }>;
}) {
  const { accessKey, id } = await params;
  await requireAdminPageSession(accessKey);
  const post = await getAdminPostById(id);
  if (!post) {
    notFound();
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>Blog · edição</p>
          <h1>Editar post</h1>
          <p className={styles.pageDescription}>
            Revise o conteúdo e salve as alterações quando estiver satisfeita.
          </p>
        </div>
      </header>
      <PostEditor
        accessKey={accessKey}
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          category: post.category,
          status: post.status,
          seoTitle: post.seoTitle ?? "",
          seoDescription: post.seoDescription ?? "",
          updatedAt: post.updatedAt.toISOString(),
        }}
      />
    </>
  );
}
