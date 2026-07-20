import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-text-primary [font:var(--text-display-m)]">Log in</h1>
        <p className="text-text-secondary [font:var(--text-body-m)]">See your own plants, devices, and readings.</p>
      </div>
      <LoginForm />
    </div>
  );
}
