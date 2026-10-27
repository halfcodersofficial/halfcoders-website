import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    // Square-ish, flat, no lift: an editor's buttons. Focus and hover show as
    // a border or a thin halo, never as movement.
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                /* Every button's default: solid primary. */
                default: "bg-primary text-primary-foreground hover:bg-primary-hover",
                /* A page's one main call to action: solid violet, set as a
                   command (`.cmd` — mono label, halo on hover). */
                brand: "cmd bg-primary font-semibold text-primary-foreground hover:bg-primary-hover",
                /* For a surface that is already the brand colour — a primary
                   panel, a dark hero: the page colour, with primary text. */
                inverse: "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
                /* The second action on a brand-coloured surface, beside `inverse`. */
                "inverse-outline":
                    "border border-primary-foreground/40 bg-transparent text-primary-foreground hover:border-primary-foreground hover:bg-primary-foreground/10",
                /* The quieter action beside a primary one ("Download the
                   curriculum" under "Enrol now"). The name is from when its
                   border was the gradient; it's a plain primary outline now. */
                "brand-outline":
                    "border border-primary/35 bg-transparent text-primary hover:border-primary hover:bg-primary/5",
                accent: "bg-accent text-accent-foreground hover:bg-accent/90",
                /* Pairs with the brand button without competing: two saturated
                   buttons side by side read as a colour clash, so the quieter
                   half of the header goes neutral-dark instead. */
                contrast: "bg-foreground text-background hover:bg-foreground/90",
                outline: "border border-border bg-transparent hover:border-border-strong hover:bg-secondary",
                /* The public site's calls to action, typed as commands
                   (`.cmd` in globals.css) — use them through
                   components/site/CtaButton.tsx, which adds the prompt and
                   link. Enrol: solid violet. Courses: a bordered command. */
                enroll: "cmd bg-primary font-semibold text-primary-foreground hover:bg-primary-hover",
                courses: "cmd border border-border-strong bg-card font-semibold text-foreground hover:border-primary hover:text-primary",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-secondary",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                sm: "h-9 px-3",
                default: "h-10 px-4 py-2",
                lg: "h-12 px-6 text-base",
                icon: "size-10",
            },
        },
        defaultVariants: { variant: "default", size: "default" },
    },
);

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    isLoading?: boolean;
}

export function Button({
    className,
    variant,
    size,
    asChild = false,
    isLoading = false,
    disabled,
    children,
    ...props
}: ButtonProps) {
    const Comp = asChild ? Slot : "button";

    // A spinner inside `asChild` would fight the single-child rule Slot
    // enforces, so loading state only applies to real buttons.
    if (asChild) {
        return (
            <Comp className={cn(buttonVariants({ variant, size, className }))} {...props}>
                {children}
            </Comp>
        );
    }

    return (
        <button
            className={cn(buttonVariants({ variant, size, className }))}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
        </button>
    );
}

export { buttonVariants };
