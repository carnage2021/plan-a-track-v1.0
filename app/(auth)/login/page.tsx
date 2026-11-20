"use client";

import { Check, Languages } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Switch } from "@/components/ui/primitives";
import { BLUR } from "@/lib/icons";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import type { Locale } from "@/lib/types";

const languages: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "gu", label: "ગુજરાતી" },
];

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  // The marketing page links here with ?mode=signup for "Create your account".
  const startMode = useSearchParams().get("mode") === "signup" ? "signup" : "signin";
  const t = useTranslations("login");
  const router = useRouter();
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const hydrated = useStore((s) => s.hydrated);
  const signedIn = useStore((s) => s.signedIn);
  const setupDone = useStore((s) => s.setupDone);
  const reload = useStore((s) => s.reload);
  const [mode, setMode] = React.useState<"signin" | "signup" | "forgot">(startMode);
  const [name, setName] = React.useState("");
  const [business, setBusiness] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [samples, setSamples] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [recoveryReady, setRecoveryReady] = React.useState(false);
  const [localOutbox, setLocalOutbox] = React.useState(false);
  const signup = mode === "signup";
  const forgot = mode === "forgot";

  // Already signed in (or just signed in): go straight to the app.
  React.useEffect(() => {
    if (hydrated && signedIn) router.replace(setupDone ? "/" : "/setup");
  }, [hydrated, signedIn, setupDone, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (forgot) {
        const res = await fetch("/api/local/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email }) });
        const body = (await res.json().catch(() => ({}))) as { error?: string; localOutbox?: boolean };
        if (!res.ok) throw new Error(body.error ?? t("recoveryError"));
        setLocalOutbox(Boolean(body.localOutbox));
        setRecoveryReady(true);
        setBusy(false);
        return;
      }
      if (signup) {
        const res = await fetch("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, business, email, password, samples }) });
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not create the account.");
      }
      // Staff sign in with the login ID the owner gave them; it is stored as <id>@staff.invalid.
      const login = email.trim().toLowerCase();
      const { error: authError } = await supabase().auth.signInWithPassword({ email: login.includes("@") ? login : `${login}@staff.invalid`, password });
      if (authError) throw new Error(t("wrong"));
      if (!(await reload())) throw new Error("This login is not linked to a catering account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
          <ul className="mt-6 space-y-2 text-sm">
            {["Photo-led menu selection with live per-plate pricing", "Quotation to confirmed order in one sitting", "Multi-function weddings on one calendar"].map((line) => (
              <li key={line} className="flex items-center gap-2"><Check className="size-4 shrink-0" strokeWidth={2} />{line}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col px-4 py-4 sm:px-8">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-heading text-base font-semibold">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">CM</span>
            Catering Manager
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost"><Languages strokeWidth={1.75} />{languages.find((l) => l.id === locale)?.label}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {languages.map((l) => <DropdownMenuItem key={l.id} onSelect={() => setLocale(l.id)}>{l.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <form onSubmit={submit} className="m-auto w-full max-w-sm py-10">
          <h1 className="font-heading text-3xl font-bold">{forgot ? t("forgotTitle") : signup ? t("signUpTitle") : t("signInTitle")}</h1>
          <p className="mt-2 text-sm text-text-muted">{forgot ? t("forgotSubtitle") : signup ? t("signUpSubtitle") : t("signInSubtitle")}</p>

          <div className="mt-8 space-y-4">
            {signup && (
              <>
                <Field label={t("name")}><Input className="!h-11" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label={t("business")}><Input className="!h-11" name="organization" autoComplete="organization" required placeholder="Royal Caterers" value={business} onChange={(e) => setBusiness(e.target.value)} /></Field>
              </>
            )}
            {!recoveryReady && <Field label={signup ? t("email") : t("emailOrId")} hint={signup || forgot ? undefined : t("emailOrIdHint")}><Input className="!h-11" type={signup ? "email" : "text"} name={signup ? "email" : "username"} autoComplete={signup ? "email" : "username"} autoCapitalize="none" spellCheck={false} required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
            {!forgot && (
              <Field label={t("password")} hint={signup ? t("passwordHint") : undefined}>
                <Input className="!h-11" type="password" name="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            )}
            {mode === "signin" && <button type="button" onClick={() => { setMode("forgot"); setError(""); }} className="block w-full text-right text-sm font-medium text-primary hover:underline">{t("forgotPassword")}</button>}
            {signup && (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div><p className="text-sm font-medium">{t("samples")}</p><p className="text-xs text-text-muted">{t("samplesHint")}</p></div>
                <Switch checked={samples} onCheckedChange={setSamples} label={t("samples")} />
              </div>
            )}
            {recoveryReady && (
              <div role="status" className="rounded-xl border border-success/25 bg-success/10 p-4">
                <span className="grid size-10 place-items-center rounded-full bg-success/15 text-success"><Check className="size-5" strokeWidth={2.5} /></span>
                <p className="mt-3 text-sm font-semibold">{t("recoveryReady")}</p>
                <p className="mt-1 text-sm text-text-muted">{localOutbox ? t("localRecoveryHint") : t("recoverySent")}</p>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
            {!recoveryReady && <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{forgot ? t("sendResetLink") : signup ? t("signUp") : t("signIn")}</Button>}
            {forgot ? (
              <Button variant="ghost" className="w-full" onClick={() => { setMode("signin"); setError(""); setRecoveryReady(false); setLocalOutbox(false); }}>{t("backToSignIn")}</Button>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => { setMode(signup ? "signin" : "signup"); setError(""); }}>{signup ? t("toSignIn") : t("toSignUp")}</Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
