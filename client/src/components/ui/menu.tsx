"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A dropdown menu, styled. Thin wrappers over Radix so every menu in the app
 * — the account menu, the row actions in the admin tables — looks and
 * behaves the same: arrow keys, Escape, click-outside, focus return.
 */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
    className,
    align = "end",
    children,
    ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
    return (
        <DropdownMenu.Portal>
            <DropdownMenu.Content
                align={align}
                sideOffset={6}
                className={cn(
                    "z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
                    className,
                )}
                style={{ boxShadow: "var(--shadow-panel)" }}
                {...props}
            >
                {children}
            </DropdownMenu.Content>
        </DropdownMenu.Portal>
    );
}

export const menuItemClass = (destructive = false) =>
    cn(
        "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        destructive
            ? "text-destructive focus:bg-destructive/10 data-highlighted:bg-destructive/10"
            : "focus:bg-secondary data-highlighted:bg-secondary",
    );

export function MenuItem({
    className,
    destructive = false,
    ...props
}: ComponentProps<typeof DropdownMenu.Item> & { destructive?: boolean }) {
    return <DropdownMenu.Item className={cn(menuItemClass(destructive), className)} {...props} />;
}

export const MenuSeparator = (props: ComponentProps<typeof DropdownMenu.Separator>) => (
    <DropdownMenu.Separator className="my-1 h-px bg-border" {...props} />
);

export const MenuLabel = ({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) => (
    <DropdownMenu.Label
        className={cn("px-2.5 py-1.5 text-xs font-medium text-muted-foreground", className)}
        {...props}
    />
);
