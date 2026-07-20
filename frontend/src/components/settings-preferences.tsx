"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

// Local UI state only, not persisted -- there's no backend preference
// storage or notification delivery system yet (that's a real, separate
// feature). Shown per the mockup rather than hidden, but honestly inert:
// reloading the page resets these.
export function SettingsPreferences() {
  const [water, setWater] = useState(true);
  const [critical, setCritical] = useState(true);
  const [weekly, setWeekly] = useState(false);

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Switch checked={water} onChange={setWater} label="Watering reminders" />
        <Switch checked={critical} onChange={setCritical} label="Critical alerts" />
        <Switch checked={weekly} onChange={setWeekly} label="Weekly summary" />
      </div>
    </Card>
  );
}
