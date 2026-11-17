import howToStartProgramming from "./posts/how-to-start-programming";
import mathForProgramming from "./posts/math-for-programming";
import whichProgrammingLanguageFirst from "./posts/which-programming-language-first";
import type { BlogPost } from "./types";

/**
 * Every blog post, draft or approved. A new post: write its file in posts/
 * (copy an existing one), add it here, and follow "How a post goes live" in
 * types.ts. The order here doesn't matter; pages sort by date.
 */
export const POSTS: BlogPost[] = [howToStartProgramming, whichProgrammingLanguageFirst, mathForProgramming];
