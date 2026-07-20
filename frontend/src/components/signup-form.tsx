"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signupAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side pass for immediate feedback -- the backend's zod schema
    // (min 8 characters, no complexity requirement) remains the authority.
    if (password.length < 8) {
      setFieldErrors({ password: "password must be at least 8 characters" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await signupAction({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      });

      if (result.ok) {
        // Unlike login, a fresh signup always has zero plants -- send
        // them through onboarding once instead of straight to /plants.
        router.push("/welcome");
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors);
        if (result.formError) {
          setFormError(result.formError);
        }
        setSubmitting(false);
      }
    } catch {
      setFormError("Something went wrong signing up.");
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
        id="name"
        label="Name (optional)"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
      />

      <Input
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
      />

      <div className="flex flex-col gap-1.5">
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        {!fieldErrors.password ? (
          <p className="text-text-muted [font:var(--text-body-s)]">At least 8 characters.</p>
        ) : null}
      </div>

      {formError ? (
        <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "Signing up…" : "Sign up"}
      </Button>

      <p className="text-text-muted [font:var(--text-body-s)]">
        Already have an account?{" "}
        <Link href="/login" className="text-text-link hover:text-text-link-hover">
          Log in
        </Link>
      </p>
    </form>
  );
}
