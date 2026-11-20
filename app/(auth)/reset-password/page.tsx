"use client";

import { Check, KeyRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { BLUR } from "@/lib/icons";

export default function ResetPasswordPage() {
  return <React.Suspense><ResetPasswordForm /></React.Suspense>;
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const t = useTranslations("login");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [updated, setUpdated] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError(t("passwordsMismatch"));
    setBusy(true);
    try {
      const response = await fetch("/api/local/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t("resetInvalid"));
      setUpdated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("resetInvalid"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image src="/dishes/veg-biryani.jpg" alt="" fill priority sizes="50vw" placeholder="blur" blurDataURL={BLUR} className="object-cover" />
        <div className="absolute inset-0 bg-text/55 dark:bg-bg/70" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-brand-fg">
          <p className="max-w-md font-heading text-3xl font-bold">{t("tagline")}</p>
        </div>
      </div>

      <div className="flex flex-col px-4 py-4 sm:px-8">
        <span className="flex items-center gap-2 font-heading text-base font-semibold">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">CM</span>
          Catering Manager
        </span>

        <main className="m-auto w-full max-w-sm py-10">
          {updated ? (
            <div role="status" className="rounded-2xl border bg-surface p-6 shadow-card">
              <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success"><Check className="size-6" strokeWidth={2.5} /></span>
              <h1 className="mt-5 font-heading text-3xl font-bold">{t("passwordUpdated")}</h1>
              <p className="mt-2 text-base text-text-muted">{t("passwordUpdatedHint")}</p>
              <Button asChild variant="primary" size="lg" className="mt-6 w-full"><Link href="/login">{t("backToSignIn")}</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"><KeyRound className="size-6" strokeWidth={1.75} /></span>
              <h1 className="mt-5 font-heading text-3xl font-bold">{t("resetTitle")}</h1>
              <p className="mt-2 text-base text-text-muted">{t("resetSubtitle")}</p>
              <div className="mt-8 space-y-4">
                <Field label={t("newPassword")} hint={t("passwordHint")}><Input className="!h-11" type="password" autoComplete="new-password" minLength={8} maxLength={128} required autoFocus value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
                <Field label={t("confirmPassword")}><Input className="!h-11" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Field>
                {!token && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{t("resetInvalid")}</p>}
                {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!token}>{t("updatePassword")}</Button>
                <Button asChild variant="ghost" className="w-full"><Link href="/login">{t("backToSignIn")}</Link></Button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
