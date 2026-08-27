"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";

import {
  initialAdminActionState,
  loginAdminAction,
} from "@/app/[accessKey]/actions";
import styles from "./admin.module.css";

export function AdminLoginForm({ accessKey }: { accessKey: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const boundAction = loginAdminAction.bind(null, accessKey);
  const [state, action, pending] = useActionState(
    boundAction,
    initialAdminActionState,
  );

  return (
    <form className={styles.form} action={action} noValidate>
      <div className={styles.field}>
        <label htmlFor="admin-username">Usuário</label>
        <input
          className={styles.input}
          id="admin-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={160}
          placeholder="Seu e-mail de acesso"
          required
          autoFocus
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="admin-password">Senha</label>
        <div className={styles.passwordWrap}>
          <input
            className={styles.input}
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            minLength={8}
            maxLength={512}
            placeholder="Sua senha"
            required
          />
          <button
            className={styles.passwordToggle}
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}

      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className={styles.buttonIcon} aria-hidden="true" />
            Verificando
          </>
        ) : (
          "Entrar no painel"
        )}
      </button>

      <p className={styles.loginSecurity}>
        <LockKeyhole aria-hidden="true" />
        <span>Este acesso é privado, protegido e monitorado por segurança.</span>
      </p>
    </form>
  );
}
