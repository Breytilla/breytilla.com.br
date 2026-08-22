import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { getAdminSession, isAdminRouteKey } from "./auth";

/** Request-scoped authorization gate shared by layouts and sensitive pages. */
export const requireAdminPageSession = cache(async (accessKey: string) => {
  if (!isAdminRouteKey(accessKey)) {
    notFound();
  }

  const session = await getAdminSession(accessKey);
  if (!session) {
    redirect(`/${accessKey}`);
  }

  return session;
});

