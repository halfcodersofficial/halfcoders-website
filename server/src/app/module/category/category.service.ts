import status from "http-status";
import { CourseStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { generateCategorySlug } from "../../utils/slug";

/**
 * Category strip on the homepage (plan §7) and the catalogue filters — active
 * categories that have at least one course to show, so the long catalogue
 * (utils/categoryCatalogue.ts) never reaches students as empty tiles. Each
 * count is what the category's /courses page lists, so a bootcamp hidden
 * from that page isn't counted.
 */
const getPublicCategories = async () => {
    const categories = await prisma.courseCategory.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { title: "asc" }],
        include: {
            _count: {
                select: {
                    courses: { where: { status: CourseStatus.PUBLISHED, isDeleted: false, hiddenFromCatalogue: false } },
                },
            },
        },
    });

    return categories
        .filter((category) => category._count.courses > 0)
        .map((category) => ({
            ...category,
            courseCount: category._count.courses,
        }));
};

const getAllCategories = async () =>
    prisma.courseCategory.findMany({
        orderBy: [{ order: "asc" }, { title: "asc" }],
        include: { _count: { select: { courses: true } } },
    });

const createCategory = async (payload: {
    title: string;
    icon?: string;
    description?: string;
    order?: number;
}) => {
    const existing = await prisma.courseCategory.findUnique({
        where: { title: payload.title },
        select: { id: true },
    });
    if (existing) throw new AppError(status.CONFLICT, "A category with this name already exists.");

    return prisma.courseCategory.create({
        data: { ...payload, slug: await generateCategorySlug(payload.title) },
    });
};

const updateCategory = async (categoryId: string, payload: Record<string, unknown>) => {
    const category = await prisma.courseCategory.findUnique({
        where: { id: categoryId },
        select: { id: true, title: true },
    });
    if (!category) throw new AppError(status.NOT_FOUND, "Category not found.");

    const data: Record<string, unknown> = { ...payload };
    if (typeof payload.title === "string" && payload.title !== category.title) {
        data.slug = await generateCategorySlug(payload.title, categoryId);
    }

    return prisma.courseCategory.update({ where: { id: categoryId }, data });
};

const deleteCategory = async (categoryId: string) => {
    const inUse = await prisma.course.count({ where: { categoryId, isDeleted: false } });
    if (inUse > 0) {
        throw new AppError(
            status.CONFLICT,
            `${inUse} course(s) still use this category. Move them first, or deactivate the category instead.`,
        );
    }

    await prisma.courseCategory.delete({ where: { id: categoryId } });
};

export const CategoryService = {
    getPublicCategories,
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
};
