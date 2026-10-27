import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    // A tag, as an editor shows one: mono, square-cornered.
    "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[0.7rem] font-medium leading-5 transition-colors",
    {
        variants: {
            variant: {
                /* Tints carry the `-ink` text shade: the base colour alone
                   falls under 4.5:1 on its own /10 tint for error and warning. */
                default: "border-transparent bg-primary/10 text-primary-ink",
                secondary: "border-transparent bg-secondary text-secondary-foreground",
                success: "border-transparent bg-success/10 text-success-ink",
                warning: "border-transparent bg-warning/10 text-warning-ink",
                destructive: "border-transparent bg-destructive/10 text-destructive-ink",
                outline: "border-border text-foreground",
            },
        },
        defaultVariants: { variant: "default" },
    },
);

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> { }

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
