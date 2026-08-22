import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPageSession } from "@/server/admin/authorize";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ accessKey: string }>;
}) {
  const { accessKey } = await params;
  const session = await requireAdminPageSession(accessKey);

  return (
    <AdminShell accessKey={accessKey} displayName={session.name}>
      {children}
    </AdminShell>
  );
}
