"use client";

import { ChevronDown } from "lucide-react";
import { NATIVE_SELECT_CLASS } from "@/lib/checkout-address";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full max-w-full min-w-0 appearance-none rounded-xl border border-input bg-background py-2 pr-11 pl-3.5 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${NATIVE_SELECT_CLASS}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
