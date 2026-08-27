"use client";

import { useActionState } from "react";
import { LoaderCircle, Send } from "lucide-react";

import { sendCampaignAction } from "@/app/[accessKey]/campaign-actions";
import { initialAdminActionState } from "@/lib/admin-action-state";
import styles from "./admin.module.css";

export function CampaignSendForm({
  accessKey,
  campaignId,
  expectedUpdatedAt,
}: {
  accessKey: string;
  campaignId: string;
  expectedUpdatedAt: string;
}) {
  const boundAction = sendCampaignAction.bind(null, accessKey, campaignId);
  const [state, action, pending] = useActionState(
    boundAction,
    initialAdminActionState,
  );

  return (
    <form className={styles.sendBox} action={action}>
      <input name="expectedUpdatedAt" type="hidden" value={expectedUpdatedAt} />
      <h2>Enviar campanha agora</h2>
      <p>
        O envio é irreversível e será feito apenas para os contatos confirmados.
        Digite <strong>ENVIAR</strong> para confirmar.
      </p>
      <div className={styles.field}>
        <label htmlFor="campaign-confirmation">Confirmação</label>
        <input
          className={styles.input}
          id="campaign-confirmation"
          name="confirmation"
          autoComplete="off"
          placeholder="ENVIAR"
          required
        />
      </div>
      {state.message ? (
        <p
          className={`${styles.formMessage} ${
            state.status === "success" ? styles.successMessage : ""
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <button className={styles.dangerButton} type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle className={styles.buttonIcon} aria-hidden="true" />
        ) : (
          <Send className={styles.buttonIcon} aria-hidden="true" />
        )}
        {pending ? "Validando audiência" : "Confirmar envio"}
      </button>
    </form>
  );
}
