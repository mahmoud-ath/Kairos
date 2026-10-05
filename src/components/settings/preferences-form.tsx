"use client";

import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { listTimeZones } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SettingsDTO, ThemePreference } from "@/types/kairos";
import { updateSettingsAction } from "@/server/actions/settings";

const THEMES: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
  { value: "system", label: "System", hint: "Match the OS" },
];

/**
 * Theme, timezone and week start.
 *
 * The timezone decides which calendar day "Today" means, so it is stored with
 * all date-only values rather than applied per request.
 */
export function PreferencesForm({ settings }: { settings: SettingsDTO }) {
  const { setTheme } = useTheme();
  const [theme, setThemeValue] = useState<ThemePreference>(settings.theme);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [weekStartsOn, setWeekStartsOn] = useState(settings.weekStartsOn);
  const [saving, setSaving] = useState(false);
  const timeZones = listTimeZones();

  async function save(patch: {
    theme?: ThemePreference;
    timezone?: string;
    weekStartsOn?: number;
  }) {
    setSaving(true);
    const result = await updateSettingsAction(patch);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Settings saved");
  }

  function chooseTheme(next: ThemePreference) {
    setThemeValue(next);
    setTheme(next);
    void save({ theme: next });
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-card px-4 py-4">
      <div>
        <h2 className="text-sm font-semibold">Appearance &amp; dates</h2>
        <p className="text-xs text-muted-foreground">
          Kairos uses your timezone to decide which tasks count as “today”.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Theme</Label>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={theme === option.value}
              onClick={() => chooseTheme(option.value)}
              className={cn(
                "flex min-w-28 flex-col items-start rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-accent",
                theme === option.value && "border-primary bg-accent",
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-timezone">Timezone</Label>
          <Select
            value={timezone}
            onValueChange={(next) => {
              setTimezone(next);
              void save({ timezone: next });
            }}
          >
            <SelectTrigger id="settings-timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {timeZones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Dates are stored as plain calendar days, so changing this never shifts them.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-week-start">Week starts on</Label>
          <Select
            value={String(weekStartsOn)}
            onValueChange={(next) => {
              const value = Number(next);
              setWeekStartsOn(value);
              void save({ weekStartsOn: value });
            }}
          >
            <SelectTrigger id="settings-week-start">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAY_LABELS.map((day, index) => (
                <SelectItem key={day} value={String(index)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Used for weekly summaries.</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {saving ? "Saving…" : "Changes are saved to your database as you make them."}
      </p>
    </section>
  );
}
