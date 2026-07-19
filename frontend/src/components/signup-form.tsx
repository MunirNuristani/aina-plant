"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signupAction } from "@/lib/actions/auth";

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
      setFormError("Something went wrong signing up.");
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
        <label htmlFor="name" className="text-sm text-ink">
          Name <span className="text-ink-muted">(optional)</span>
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
        />
        {fieldErrors.name ? <p className="text-sm text-error">{fieldErrors.name}</p> : null}
      </div>

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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm text-ink"
        />
        {fieldErrors.password ? (
          <p className="text-sm text-error">{fieldErrors.password}</p>
        ) : (
          <p className="text-sm text-ink-muted">At least 8 characters.</p>
        )}
      </div>

      {formError ? <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-ink">{formError}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Signing up…" : "Sign up"}
      </button>

      <p className="text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:opacity-90">
          Log in
        </Link>
      </p>
    </form>
  );
}
