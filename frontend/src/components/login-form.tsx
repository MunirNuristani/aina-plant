"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";


export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-row gap-2 justify-center relative">
          <Input
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
          />
          <div className="absolute right-2 top-1/2">
            {showPassword ? (
              <button
                type="button"
                onClick={() => setShowPassword(false)}
                className="text-text-muted [font:var(--text-body-s)]"
              >
                <EyeOff />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPassword(true)}
                className="text-text-muted [font:var(--text-body-s)]"
              >

                <Eye />
              </button>
            )}
          </div>
        </div>
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
