"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      className="flex flex-col gap-4 rounded-l border border-border-default bg-surface-card p-6 shadow-card"
    >
      <Input
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
      />

      <Input
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
      />

      {formError ? (
        <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-text-muted [font:var(--text-body-s)]">
        No account?{" "}
        <Link href="/signup" className="text-text-link hover:text-text-link-hover">
          Sign up
        </Link>
      </p>
    </form>
  );
}
