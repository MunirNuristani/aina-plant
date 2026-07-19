"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    setSubmitting(true);
    try {
      const result = await loginAction({ email: email.trim(), password });

      if (result.ok) {
        router.push("/plants");
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors);
        if (result.formError) {
          setFormError(result.formError);
        }
        setSubmitting(false);
      }
    } catch {
      setFormError("Something went wrong logging in.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-ink">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
        />
        {fieldErrors.email ? <p className="text-sm text-error">{fieldErrors.email}</p> : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-ink">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
        />
        {fieldErrors.password ? <p className="text-sm text-error">{fieldErrors.password}</p> : null}
      </div>

      {formError ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-ink">{formError}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>

      <p className="text-sm text-ink-muted">
        No account?{" "}
        <Link href="/signup" className="text-primary hover:opacity-90">
          Sign up
        </Link>
      </p>
    </form>
  );
}
