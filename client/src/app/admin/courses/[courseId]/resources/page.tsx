import { redirect } from "next/navigation";

/** Resources moved into the Module Manager; old links and bookmarks land there. */
export default async function AdminResourcesPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = await params;
    redirect(`/admin/courses/${courseId}/modules`);
}
