import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        // Generated Prisma client and build output are not ours to lint.
        ignores: ["dist/**", "src/generated/**", "node_modules/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
);
