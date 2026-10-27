"use client";

import { ExternalLink, MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

export interface RowAction {
    label: string;
    icon?: LucideIcon;
    onSelect?: () => void;
    /** A link instead of a handler. */
    href?: string;
    /** Opens the link in a new tab — the public page, the verification page. */
    external?: boolean;
    destructive?: boolean;
    /** Drop the item entirely for this row — not the same as `disabled`. */
    hidden?: boolean;
    disabled?: boolean;
    /** A divider above this item, to separate the dangerous ones. */
    separatorBefore?: boolean;
}

interface RowActionsProps {
    /** The one thing most admins do with this row — always visible. */
    primary?: ReactNode;
    /** Everything else, behind a "⋯" button. */
    items?: RowAction[];
    label?: string;
}

/**
 * The right-hand end of every table row: one visible button, one overflow
 * menu. A row that showed five buttons was the main reason the old screens
 * read as cluttered — most of them were used once a month.
 */
export default function RowActions({ primary, items = [], label = "More actions" }: RowActionsProps) {
    const visible = items.filter((item) => !item.hidden);

    return (
        <div className="flex items-center justify-end gap-1">
            {primary}

            {visible.length > 0 && (
                <Menu>
                    <MenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 px-0" aria-label={label}>
                            <MoreHorizontal />
                        </Button>
                    </MenuTrigger>
                    <MenuContent>
                        {visible.map((item, index) => {
                            const Icon = item.icon;
                            const body = (
                                <>
                                    {Icon && (
                                        <Icon
                                            className={cn("size-4 shrink-0", !item.destructive && "text-muted-foreground")}
                                            aria-hidden
                                        />
                                    )}
                                    <span className="flex-1">{item.label}</span>
                                    {item.external && (
                                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                    )}
                                </>
                            );

                            return (
                                <Fragment key={item.label}>
                                    {item.separatorBefore && index > 0 && <MenuSeparator />}

                                    {item.href ? (
                                        <MenuItem asChild destructive={item.destructive} disabled={item.disabled}>
                                            <Link
                                                href={item.href}
                                                target={item.external ? "_blank" : undefined}
                                                rel={item.external ? "noopener noreferrer" : undefined}
                                            >
                                                {body}
                                            </Link>
                                        </MenuItem>
                                    ) : (
                                        <MenuItem
                                            destructive={item.destructive}
                                            disabled={item.disabled}
                                            // Deferred a tick so the menu has finished
                                            // closing before a dialog the handler opens
                                            // takes focus.
                                            onSelect={() => setTimeout(() => item.onSelect?.(), 0)}
                                        >
                                            {body}
                                        </MenuItem>
                                    )}
                                </Fragment>
                            );
                        })}
                    </MenuContent>
                </Menu>
            )}
        </div>
    );
}
