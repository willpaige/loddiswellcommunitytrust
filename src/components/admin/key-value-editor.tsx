"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type KeyValuePair = { key: string; value: string };

type Props = {
  value: KeyValuePair[];
  onChange: (next: KeyValuePair[]) => void;
  keyLabel?: string;
  valueLabel?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  emptyLabel?: string;
};

export function KeyValueEditor({
  value,
  onChange,
  keyLabel = "Label",
  valueLabel = "Value",
  keyPlaceholder = "Hourly rate",
  valuePlaceholder = "£15",
  addLabel = "Add row",
  emptyLabel = "No rows yet.",
}: Props) {
  function update(index: number, patch: Partial<KeyValuePair>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function add() {
    onChange([...value, { key: "", value: "" }]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>{keyLabel}</span>
          <span>{valueLabel}</span>
          <span className="sr-only">Remove</span>
        </div>
      )}

      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <Input
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            aria-label="Remove row"
            className="h-9 w-9"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </Button>
    </div>
  );
}
