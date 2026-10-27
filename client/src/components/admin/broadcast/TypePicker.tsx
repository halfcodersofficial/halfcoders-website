"use client";

import { BookOpen, ClipboardList, Headphones, Layers, Megaphone, Settings2 } from "lucide-react";
import { useField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export const NOTIFICATION_TYPES = [
    { value: "GENERAL", label: "General", icon: Megaphone },
    { value: "COURSE", label: "Course", icon: BookOpen },
    { value: "MODULE", label: "Module", icon: Layers },
    { value: "ASSIGNMENT", label: "Assignment", icon: ClipboardList },
    { value: "SUPPORT", label: "Support", icon: Headphones },
    { value: "SYSTEM", label: "System", icon: Settings2 },
] as const;

/**
 * The notification's type as one row of chips — six short words read faster
 * side by side than inside a select. Native radios underneath, wired by
 * `FormField` the same way `RadioGroup` is.
 */
export default function TypePicker() {
    const field = useField();

    return (
        <div role="radiogroup" aria-describedby={field?.describedBy} className="flex flex-wrap gap-2">
            {NOTIFICATION_TYPES.map((type, index) => {
                const checked = field?.value === type.value;

                return (
                    <label
                        key={type.value}
                        className={cn(
                            "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                            "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background",
                            checked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                    >
                        <input
                            type="radio"
                            id={index === 0 ? field?.id : undefined}
                            name={field?.id}
                            value={type.value}
                            checked={checked}
                            onChange={() => field?.setValue(type.value)}
                            onBlur={field?.onBlur}
                            className="sr-only"
                        />
                        <type.icon className="size-3.5" aria-hidden />
                        {type.label}
                    </label>
                );
            })}
        </div>
    );
}
