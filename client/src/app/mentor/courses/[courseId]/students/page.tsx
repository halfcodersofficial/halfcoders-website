import { redirect } from "next/navigation";

/**
 * Mentors don't get the course roster — they see how many are enrolled, and a
 * student's name only where they mark that student's work (Results, the review
 * queue). Old links and bookmarks land on the course instead.
 */
export default async function MentorCourseStudentsPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = await params;
    redirect(`/mentor/courses/${courseId}`);
}
