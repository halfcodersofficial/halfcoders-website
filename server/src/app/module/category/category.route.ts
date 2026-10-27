import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { createCategoryZodSchema, updateCategoryZodSchema } from "../course/course.validation";
import { CategoryController } from "./category.controller";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/", CategoryController.getPublicCategories);

router.get("/manage", checkAuth(...ADMINS), CategoryController.getAllCategories);

router.post(
    "/manage",
    checkAuth(...ADMINS),
    validateRequest(createCategoryZodSchema),
    CategoryController.createCategory,
);

router.patch(
    "/manage/:categoryId",
    checkAuth(...ADMINS),
    validateRequest(updateCategoryZodSchema),
    CategoryController.updateCategory,
);

router.delete("/manage/:categoryId", checkAuth(...ADMINS), CategoryController.deleteCategory);

export const CategoryRoutes = router;
