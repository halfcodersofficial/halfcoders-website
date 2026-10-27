import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * The card surface: a pane in the editor — hairline border, barely rounded,
 * no shadow to speak of. Exported
 * so a link or an article can wear it too: `cardVariants({ variant: "interactive" })`.
 */
export const cardVariants = cva("border text-card-foreground", {
    variants: {
        variant: {
            default: "border-border bg-card",
            /* The quiet tint — a bento cell, a well inside a white band. */
            surface: "border-border bg-surface",
            /* Something you can click as a whole: the border turns violet and
               a thin halo arrives on hover. No lift — the page stays still. */
            interactive:
                "border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/50 hover:shadow-card-hover motion-reduce:transition-none",
        },
        shape: {
            card: "rounded-card",
            panel: "rounded-panel",
        },
    },
    defaultVariants: { variant: "default", shape: "card" },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> { }

export const Card = ({ className, variant, shape, ...props }: CardProps) => (
    <div className={cn(cardVariants({ variant, shape }), className)} {...props} />
);

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={cn("text-lg font-semibold leading-tight tracking-tight", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("p-6 pt-0", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);
