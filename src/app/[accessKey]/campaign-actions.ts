"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AdminActionState } from "@/lib/admin-action-state";
import { getAdminSession, isAdminRouteKey } from "@/server/admin/auth";
import {
  AdminCampaignError,
  campaignInputSchema,
  saveCampaignDraft,
  sendCampaignNow,
  type CampaignInput,
} from "@/server/admin/campaigns";

function formText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

async function requireCampaignAdmin(accessKey: string) {
  if (!isAdminRouteKey(accessKey)) {
    redirect("/");
  }
  const session = await getAdminSession(accessKey);
  if (!session) {
    redirect(`/${accessKey}`);
  }
  return session;
}

function campaignInputFromForm(formData: FormData): CampaignInput {
  return {
    id: formText(formData, "id"),
    campaignKey: formText(formData, "campaignKey"),
    name: formText(formData, "name"),
    subject: formText(formData, "subject"),
    preheader: formText(formData, "preheader"),
    title: formText(formData, "title"),
    intro: formText(formData, "intro"),
    sectionHeading: formText(formData, "sectionHeading"),
    body: formText(formData, "body"),
    ctaLabel: formText(formData, "ctaLabel"),
    ctaUrl: formText(formData, "ctaUrl"),
  };
}

function saveErrorMessage(error: unknown): string {
  if (!(error instanceof AdminCampaignError)) {
    return "Não foi possível salvar a campanha agora. Tente novamente.";
  }

  const messages: Partial<Record<AdminCampaignError["code"], string>> = {
    CAMPAIGN_KEY_EXISTS: "Este identificador de campanha já está em uso.",
    CAMPAIGN_KEY_IMMUTABLE: "O identificador não pode ser alterado depois que o rascunho é criado.",
    CAMPAIGN_NOT_DRAFT: "Somente campanhas em rascunho podem ser editadas.",
    CAMPAIGN_PROVIDER_REJECTED: "O Resend recusou a atualização. Revise a configuração e tente novamente.",
  };
  return messages[error.code] ?? "Não foi possível salvar a campanha agora. Tente novamente.";
}

export async function saveCampaignAction(
  accessKey: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireCampaignAdmin(accessKey);
  const parsed = campaignInputSchema.safeParse(campaignInputFromForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados antes de salvar.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await saveCampaignDraft(parsed.data);
    revalidatePath(`/${accessKey}/emails`);
    revalidatePath(`/${accessKey}/painel`);
  } catch (error) {
    return { status: "error", message: saveErrorMessage(error) };
  }

  redirect(`/${accessKey}/emails?salvo=1`);
}

function sendErrorMessage(error: unknown): string {
  if (!(error instanceof AdminCampaignError)) {
    return "Não foi possível iniciar o envio. Nenhuma nova tentativa foi feita automaticamente.";
  }

  const messages: Partial<Record<AdminCampaignError["code"], string>> = {
    CAMPAIGN_SEND_CONFIRMATION_REQUIRED: "Digite ENVIAR exatamente como indicado para confirmar.",
    CAMPAIGN_AUDIENCE_DRIFT:
      "Envio bloqueado: a audiência do Resend diverge dos consentimentos locais. Execute a reconciliação antes de continuar.",
    CAMPAIGN_NOT_DRAFT: "Esta campanha não está mais disponível para envio.",
    CAMPAIGN_BROADCAST_MISSING: "O rascunho ainda não está sincronizado com o Resend.",
    CAMPAIGN_CONTENT_INVALID:
      "Este rascunho é antigo ou incompleto. Salve-o novamente antes de enviar.",
    CAMPAIGN_VERSION_CHANGED:
      "A campanha mudou depois que a revisão foi aberta. Volte, confira a versão mais recente e revise novamente.",
    CAMPAIGN_SEND_RESULT_UNCERTAIN:
      "O resultado do Resend ficou incerto. A campanha foi bloqueada em “enviando”; não tente novamente para evitar duplicidade.",
    CAMPAIGN_SEND_PERSIST_FAILED:
      "O Resend aceitou o envio, mas o histórico local precisa de reconciliação. Não envie novamente.",
  };
  return messages[error.code] ?? "O envio foi bloqueado com segurança. Revise a campanha antes de tentar novamente.";
}

export async function sendCampaignAction(
  accessKey: string,
  campaignId: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireCampaignAdmin(accessKey);
  if (Date.now() - session.issuedAt > 30 * 60 * 1_000) {
    return {
      status: "error",
      message: "Por segurança, saia e entre novamente antes de fazer um envio real.",
    };
  }

  try {
    const result = await sendCampaignNow(
      campaignId,
      formText(formData, "confirmation"),
      formText(formData, "expectedUpdatedAt"),
    );
    revalidatePath(`/${accessKey}/emails`);
    revalidatePath(`/${accessKey}/emails/${campaignId}`);
    revalidatePath(`/${accessKey}/painel`);
    return {
      status: "success",
      message: `Envio aceito para ${result.audienceSize} assinante${
        result.audienceSize === 1 ? "" : "s"
      } confirmado${result.audienceSize === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return { status: "error", message: sendErrorMessage(error) };
  }
}
