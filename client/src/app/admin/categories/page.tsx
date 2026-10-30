"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CategoryModal from "@/components/admin/CategoryModal";
import DataShell from "@/components/admin/DataShell";
import DataTable, { type Column } from "@/components/admin/DataTable";
import ViewToggle, { type ViewMode } from "@/components/admin/ViewToggle";
import CategoryIcon from "@/components/shared/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { confirmAction } from "@/lib/confirm";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";
import type { AdminCategory } from "@/types/admin.types";

const PAGE_SIZE = 16;

const FILTERS = [
    { value: "", label: "All" },
    { value: "active", label: "Visible" },
    { value: "hidden", label: "Hidden" },
];

const courseCount = (category: AdminCategory) =>
    `${category._count.courses} ${category._count.courses === 1 ? "course" : "courses"}`;

export default function AdminCategoriesPage() {
    const queryClient = useQueryClient();
    const [view, setView] = useState<ViewMode>("grid");
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [visibility, setVisibility] = useState("");

    // Open state and target are kept apart so the modal's title doesn't flip
    // to "New category" while an edit modal is still animating out.
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const openModal = (categoryId: string | null) => {
        setEditingId(categoryId);
        setModalOpen(true);
    };

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "categories"],
        queryFn: adminService.allCategories,
    });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
        void queryClient.invalidateQueries({ queryKey: ["categories"] });
    };

    const toggleActive = useMutation({
        mutationFn: ({ id, next }: { id: string; next: boolean }) =>
            adminService.updateCategory(id, { isActive: next }),
        onSuccess: () => {
            toast.success("Category updated.");
            refresh();
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update that category.")),
    });

    const remove = useMutation({
        mutationFn: (id: string) => adminService.deleteCategory(id),
        onSuccess: () => {
            toast.success("Category deleted.");
            refresh();
        },
        // The API refuses to delete a category still holding courses — its
        // message names the count, so pass it through.
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't delete that category.")),
    });

    const categories = data ?? [];
    const editing = editingId ? (categories.find((category) => category.id === editingId) ?? null) : null;

    // The API returns every category — the course pickers need them all — so
    // search, filtering and paging all happen here.
    const needle = searchTerm.toLowerCase();
    const shown = categories.filter(
        (category) =>
            (visibility === "" || category.isActive === (visibility === "active")) &&
            (!needle ||
                category.title.toLowerCase().includes(needle) ||
                category.slug.toLowerCase().includes(needle) ||
                (category.description ?? "").toLowerCase().includes(needle)),
    );
    const filtered = Boolean(needle || visibility);

    // Clamped so deleting the last card on the last page doesn't leave the
    // admin on an empty one.
    const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageRows = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const meta = { page: currentPage, limit: PAGE_SIZE, total: shown.length, totalPages };

    const actions = (category: AdminCategory) => (
        <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => openModal(category.id)}>
                <Pencil /> Edit
            </Button>
            <Button
                size="sm"
                variant={category.isActive ? "outline" : "default"}
                isLoading={toggleActive.isPending && toggleActive.variables?.id === category.id}
                onClick={() => toggleActive.mutate({ id: category.id, next: !category.isActive })}
            >
                {category.isActive ? <EyeOff /> : <Eye />}
                {category.isActive ? "Hide" : "Show"}
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive hover:bg-destructive/10"
                aria-label={`Delete ${category.title}`}
                onClick={async () => {
                    if (
                        await confirmAction({
                            title: `Delete "${category.title}"?`,
                            confirmText: "Delete category",
                        })
                    ) {
                        remove.mutate(category.id);
                    }
                }}
            >
                <Trash2 />
            </Button>
        </div>
    );

    const columns: Column<AdminCategory>[] = [
        {
            id: "category",
            header: "Category",
            primary: true,
            sortable: true,
            sortValue: (category) => category.title,
            cell: (category) => (
                <div className="flex min-w-0 items-center gap-3">
                    <CategoryTile category={category} className="size-9 rounded-md" />
                    <div className="min-w-0">
                        <button
                            type="button"
                            onClick={() => openModal(category.id)}
                            className="truncate font-medium hover:underline"
                        >
                            {category.title}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">/{category.slug}</p>
                    </div>
                </div>
            ),
        },
        {
            id: "description",
            header: "Description",
            hideOnMobile: true,
            cell: (category) =>
                category.description ? (
                    <p className="line-clamp-1 max-w-md text-muted-foreground">{category.description}</p>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: "courses",
            header: "Courses",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (category) => category._count.courses,
            cell: (category) => category._count.courses,
        },
        {
            id: "order",
            header: "Sort order",
            className: "whitespace-nowrap tabular-nums",
            sortable: true,
            sortValue: (category) => category.order,
            cell: (category) => category.order,
        },
        {
            id: "status",
            header: "Status",
            cell: (category) => <StatusBadge category={category} />,
        },
    ];

    const newCategoryButton = (
        <Button onClick={() => openModal(null)}>
            <Plus /> New category
        </Button>
    );

    return (
        <>
            <DataShell
                title="Categories"
                description="How courses are grouped. Students see a category on the homepage and in the catalogue filters once it has a published course."
                action={
                    <div className="flex items-center gap-2">
                        {categories.length > 0 && <ViewToggle value={view} onChange={setView} />}
                        {newCategoryButton}
                    </div>
                }
                searchPlaceholder="Search categories…"
                onSearch={(term) => {
                    setSearchTerm(term);
                    setPage(1);
                }}
                filters={FILTERS}
                activeFilter={visibility}
                onFilter={(value) => {
                    setVisibility(value);
                    setPage(1);
                }}
                isLoading={isLoading}
                isEmpty={pageRows.length === 0}
                emptyMessage={filtered ? "No categories match." : "No categories yet."}
                emptyHint={
                    filtered
                        ? "Try a different search or filter."
                        : "Add one, then pick it on each course so the catalogue can filter by it."
                }
                emptyAction={filtered ? undefined : newCategoryButton}
                meta={meta}
                onPage={setPage}
            >
                {view === "grid" ? (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {pageRows.map((category) => (
                            <li key={category.id}>
                                <Card
                                    className={cn(
                                        "flex h-full flex-col shadow-card",
                                        !category.isActive && "bg-secondary/30",
                                    )}
                                >
                                    <CardContent className="flex flex-1 flex-col gap-4 p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <CategoryTile category={category} className="size-11 rounded-card" />
                                            <StatusBadge category={category} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <button
                                                type="button"
                                                onClick={() => openModal(category.id)}
                                                title={category.title}
                                                className="block max-w-full truncate text-left font-medium hover:underline"
                                            >
                                                {category.title}
                                            </button>
                                            <p className="truncate text-xs text-muted-foreground">/{category.slug}</p>
                                            {category.description && (
                                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                                    {category.description}
                                                </p>
                                            )}
                                        </div>

                                        <p className="text-xs text-muted-foreground">
                                            {courseCount(category)} · Sort order {category.order}
                                        </p>

                                        <div className="border-t border-border pt-4">{actions(category)}</div>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <DataTable
                        rows={pageRows}
                        columns={columns}
                        rowKey={(category) => category.id}
                        actions={actions}
                    />
                )}
            </DataShell>

            <CategoryModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                category={editing}
            />
        </>
    );
}

function CategoryTile({ category, className }: { category: AdminCategory; className?: string }) {
    return (
        <div
            className={cn(
                "grid shrink-0 place-items-center",
                category.isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                className,
            )}
        >
            <CategoryIcon name={category.icon} />
        </div>
    );
}

function StatusBadge({ category }: { category: AdminCategory }) {
    return (
        <Badge variant={category.isActive ? "success" : "secondary"}>
            {category.isActive ? "Active" : "Hidden"}
        </Badge>
    );
}
