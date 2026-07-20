import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsPreferences } from "@/components/settings-preferences";
import { getDevices } from "@/lib/devices";
import { getSessionEmail } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth";
import packageJson from "../../../../package.json";

export default async function SettingsPage() {
  const [email, devices] = await Promise.all([getSessionEmail(), getDevices()]);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="mb-1 text-text-primary [font:var(--text-display-m)]">Settings</h1>

      <SettingsPreferences />

      <Card>
        <div className="flex flex-col gap-3.5 text-text-primary [font:var(--text-body-m)]">
          <div className="flex justify-between">
            <span>Account</span>
            <span className="text-text-muted">{email ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Devices paired</span>
            <span className="text-text-muted [font:var(--text-mono-m)]">{devices.length}</span>
          </div>
          <div className="flex justify-between">
            <span>App version</span>
            <span className="text-text-muted [font:var(--text-mono-m)]">{packageJson.version}</span>
          </div>
        </div>
      </Card>

      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
