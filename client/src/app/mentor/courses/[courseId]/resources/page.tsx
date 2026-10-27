import { redirect } from "next/navigation";

/** Resources moved into the Module Manager; old links and bookmarks land there. */
export default async function MentorResourcesPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = await params;
    redirect(`/mentor/courses/${courseId}/modules`);
}
