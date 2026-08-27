"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  clearAdminSessionCookie,
  createAccountLoginFingerprint,
  createLoginFingerprint,
  getAdminSession,
  isAdminRouteKey,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/server/admin/auth";
import { recordAdminAuditEvent } from "@/server/admin/audit";
import { verifyWithinLoginLimit } from "@/server/admin/login-rate-limit";
import {
  blogPostInputSchema,
  saveBlogPost,
  type BlogPostInput,
} from "@/server/admin/posts";

export type AdminActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAdminActionState: AdminActionState = { status: "idle" };

const loginSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(8).max(512),
});

function formText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

async function requireAdminForAction(accessKey: string): Promise<void> {
  if (!isAdminRouteKey(accessKey) || !(await getAdminSession(accessKey))) {
    redirect(`/${encodeURIComponent(accessKey)}`);
  }
}

function clientAddressFromHeaders(headerStore: Awaited<ReturnType<typeof headers>>): string {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || headerStore.get("x-real-ip") || "unknown").slice(0, 120);
}

export async function loginAdminAction(
  accessKey: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!isAdminRouteKey(accessKey)) {
    return { status: "error", message: "Não foi possível concluir o acesso." };
  }

  const parsed = loginSchema.safeParse({
    username: formText(formData, "username"),
    password: formText(formData, "password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Informe seu usuário e sua senha para continuar.",
    };
  }

  try {
    const headerStore = await headers();
    const fingerprint = createLoginFingerprint({
      clientAddress: clientAddressFromHeaders(headerStore),
    });
    const result = await verifyWithinLoginLimit(
      [
        { fingerprintHash: fingerprint, maxFailures: 8 },
        {
          fingerprintHash: createAccountLoginFingerprint(),
          maxFailures: 40,
        },
      ],
      () => verifyAdminCredentials(parsed.data),
    );

    if (result !== "allowed") {
      return {
        status: "error",
        message:
          "Usuário ou senha inválidos. Verifique os dados e tente novamente em alguns minutos.",
      };
    }

    await setAdminSessionCookie();
    try {
      await recordAdminAuditEvent({
        action: "session.created",
        entityType: "admin_session",
      });
    } catch {
      // Authentication remains available if non-critical audit persistence fails.
    }
  } catch {
    return {
      status: "error",
      message:
        "O acesso está temporariamente indisponível. Tente novamente em alguns instantes.",
    };
  }

  redirect(`/${accessKey}/painel`);
}

export async function logoutAdminAction(accessKey: string): Promise<void> {
  if (isAdminRouteKey(accessKey)) {
    try {
      await clearAdminSessionCookie();
    } catch {
      redirect(`/${accessKey}/configuracoes?logout=erro`);
    }
  }
  redirect("/");
}

function postInputFromForm(formData: FormData): BlogPostInput {
  return {
    id: formText(formData, "id"),
    version: formText(formData, "version"),
    title: formText(formData, "title"),
    slug: formText(formData, "slug"),
    excerpt: formText(formData, "excerpt"),
    content: formText(formData, "content"),
    category: formText(formData, "category"),
    status: formText(formData, "status") as BlogPostInput["status"],
    seoTitle: formText(formData, "seoTitle"),
    seoDescription: formText(formData, "seoDescription"),
  };
}

export async function savePostAction(
  accessKey: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminForAction(accessKey);

  const parsed = blogPostInputSchema.safeParse(postInputFromForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados antes de salvar.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const saved = await saveBlogPost(parsed.data);
    revalidatePath("/blog");
    revalidatePath(`/blog/${saved.slug}`);
    revalidatePath(`/${accessKey}/posts`);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : "";
    return {
      status: "error",
      message:
        code === "23505"
          ? "Este endereço de post já está em uso. Escolha outro slug."
          : message === "POST_VERSION_CONFLICT"
            ? "Este post foi alterado em outra aba. Recarregue a página antes de salvar para não perder mudanças."
          : "Não foi possível salvar o post agora. Tente novamente.",
    };
  }

  redirect(`/${accessKey}/posts?salvo=1`);
}
