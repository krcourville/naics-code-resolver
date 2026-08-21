import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
import { Input } from "./ui/input.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet.tsx";
import { clampFloor, type Settings } from "../naics/settings.ts";

// §V3/§V4: gear icon opens a right-side Sheet w/ only floor + showDef — ⊥ result-view setting.
export function SettingsSheet({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          id="settings-trigger"
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Settings"
        >
          <SettingsIcon />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <label htmlFor="setting-floor" className="flex flex-col gap-1.5 text-sm">
            Confidence floor (0–1)
            <Input
              type="number"
              id="setting-floor"
              className="w-24"
              min={0}
              max={1}
              step={0.05}
              value={settings.floor}
              onChange={(e) =>
                onChange({ ...settings, floor: clampFloor(Number(e.target.value) || 0) })
              }
            />
          </label>
          <label htmlFor="setting-showdef" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="setting-showdef"
              checked={settings.showDef}
              onCheckedChange={(checked) => onChange({ ...settings, showDef: checked === true })}
            />
            Show definitions
          </label>
        </div>
      </SheetContent>
    </Sheet>
  );
}
