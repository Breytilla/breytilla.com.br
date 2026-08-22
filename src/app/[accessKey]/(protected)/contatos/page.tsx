import { Users } from "lucide-react";

import styles from "@/components/admin/admin.module.css";
import { requireAdminPageSession } from "@/server/admin/authorize";
import { listAdminContacts } from "@/server/admin/dashboard";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const marketingLabels: Record<string, string> = {
  never_subscribed: "Sem inscrição",
  pending: "Aguardando confirmação",
  subscribed: "Inscrito",
  unsubscribed: "Descadastrado",
  blocked: "Bloqueado",
};

const requestLabels: Record<string, string> = {
  received: "Recebido",
  acknowledged: "Em acompanhamento",
  handled: "Atendido",
  archived: "Arquivado",
};

const channelLabels: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  phone: "Telefone",
};

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ accessKey: string }>;
}) {
  const { accessKey } = await params;
  await requireAdminPageSession(accessKey);
  const contacts = await listAdminContacts();

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderText}>
          <p className={styles.eyebrow}>Relacionamento</p>
          <h1>Contatos</h1>
          <p className={styles.pageDescription}>
            Consulte pedidos recebidos e o estado de consentimento da newsletter.
          </p>
        </div>
      </header>

      {contacts.length > 0 ? (
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Lista de contatos"
          tabIndex={0}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Contato</th>
                <th>Newsletter</th>
                <th>Pedido recente</th>
                <th>Canal preferido</th>
                <th>Entrada</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <span className={styles.contactName}>{contact.name || "Sem nome informado"}</span>
                    <a className={styles.contactEmail} href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        contact.marketingStatus === "subscribed" ? styles.badgeSuccess : ""
                      }`}
                    >
                      {marketingLabels[contact.marketingStatus] ?? contact.marketingStatus}
                    </span>
                  </td>
                  <td>
                    {contact.requestStatus
                      ? requestLabels[contact.requestStatus] ?? contact.requestStatus
                      : "—"}
                  </td>
                  <td>
                    {contact.preferredChannel
                      ? channelLabels[contact.preferredChannel] ?? contact.preferredChannel
                      : "—"}
                    {contact.phone ? (
                      contact.preferredChannel === "whatsapp" ? (
                        <a
                          className={styles.tableMeta}
                          href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir conversa
                        </a>
                      ) : (
                        <a className={styles.tableMeta} href={`tel:${contact.phone}`}>
                          {contact.phone}
                        </a>
                      )
                    ) : null}
                  </td>
                  <td>{dateFormatter.format(contact.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`${styles.panel} ${styles.emptyState}`}>
          <Users aria-hidden="true" />
          <p>Nenhum contato recebido até o momento.</p>
        </div>
      )}
    </>
  );
}
