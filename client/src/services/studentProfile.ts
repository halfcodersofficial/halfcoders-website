import httpClient from "@/lib/httpClient";
import type { ApiMeta, ApiResponse } from "@/types/api.types";
import type {
    ProfileOverview,
    StudentAddress,
    StudentAdditionalInfo,
    StudentCourseRequest,
    StudentEducation,
    StudentHiredRecord,
    StudentJobExperience,
    StudentJobProfile,
    StudentLinks,
    StudentProject,
    StudentSkill,
} from "@/types/profile.types";

const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

const unwrapList = <T>(response: { data: ApiResponse<T> }): { data: T; meta?: ApiMeta } => ({
    data: response.data.data,
    meta: response.data.meta,
});

/** The 5 singleton profile sections + the overview/completion aggregate. */
export const studentProfileService = {
    overview: () => httpClient.get<ApiResponse<ProfileOverview>>("/student-profile/overview").then(unwrap),

    additionalInfo: () =>
        httpClient
            .get<ApiResponse<StudentAdditionalInfo | null>>("/student-profile/additional-info")
            .then(unwrap),
    updateAdditionalInfo: (payload: Partial<StudentAdditionalInfo>) =>
        httpClient
            .put<ApiResponse<StudentAdditionalInfo>>("/student-profile/additional-info", payload)
            .then(unwrap),

    address: () =>
        httpClient.get<ApiResponse<StudentAddress | null>>("/student-profile/address").then(unwrap),
    updateAddress: (payload: Partial<StudentAddress>) =>
        httpClient.put<ApiResponse<StudentAddress>>("/student-profile/address", payload).then(unwrap),

    education: () =>
        httpClient.get<ApiResponse<StudentEducation | null>>("/student-profile/education").then(unwrap),
    updateEducation: (payload: Partial<StudentEducation>) =>
        httpClient.put<ApiResponse<StudentEducation>>("/student-profile/education", payload).then(unwrap),

    links: () => httpClient.get<ApiResponse<StudentLinks | null>>("/student-profile/links").then(unwrap),
    updateLinks: (payload: Partial<StudentLinks>) =>
        httpClient.put<ApiResponse<StudentLinks>>("/student-profile/links", payload).then(unwrap),

    jobProfile: () =>
        httpClient.get<ApiResponse<StudentJobProfile | null>>("/student-profile/job-profile").then(unwrap),
    updateJobProfile: (payload: Partial<StudentJobProfile>) =>
        httpClient.put<ApiResponse<StudentJobProfile>>("/student-profile/job-profile", payload).then(unwrap),
};

export const studentSkillService = {
    list: () => httpClient.get<ApiResponse<StudentSkill[]>>("/student-skills").then(unwrapList),
    create: (payload: { name: string; yearsOfExperience?: string; projectLink?: string }) =>
        httpClient.post<ApiResponse<StudentSkill>>("/student-skills", payload).then(unwrap),
    update: (id: string, payload: Partial<Pick<StudentSkill, "name" | "yearsOfExperience" | "projectLink">>) =>
        httpClient.patch<ApiResponse<StudentSkill>>(`/student-skills/${id}`, payload).then(unwrap),
    remove: (id: string) => httpClient.delete(`/student-skills/${id}`).then(() => undefined),
};

export const studentProjectService = {
    list: () => httpClient.get<ApiResponse<StudentProject[]>>("/student-projects").then(unwrapList),
    create: (payload: { title: string; description?: string; url: string }) =>
        httpClient.post<ApiResponse<StudentProject>>("/student-projects", payload).then(unwrap),
    update: (id: string, payload: Partial<Pick<StudentProject, "title" | "description" | "url">>) =>
        httpClient.patch<ApiResponse<StudentProject>>(`/student-projects/${id}`, payload).then(unwrap),
    remove: (id: string) => httpClient.delete(`/student-projects/${id}`).then(() => undefined),
};

type JobExperiencePayload = Partial<
    Pick<
        StudentJobExperience,
        "designation" | "companyName" | "isRelatedToIt" | "description" | "isCurrentlyWorking"
    >
> & { startDate?: string | null; endDate?: string | null };

export const studentJobExperienceService = {
    list: () =>
        httpClient.get<ApiResponse<StudentJobExperience[]>>("/student-job-experiences").then(unwrapList),
    create: (payload: JobExperiencePayload) =>
        httpClient.post<ApiResponse<StudentJobExperience>>("/student-job-experiences", payload).then(unwrap),
    update: (id: string, payload: JobExperiencePayload) =>
        httpClient
            .patch<ApiResponse<StudentJobExperience>>(`/student-job-experiences/${id}`, payload)
            .then(unwrap),
    remove: (id: string) => httpClient.delete(`/student-job-experiences/${id}`).then(() => undefined),
};

type HiredRecordPayload = Partial<
    Pick<
        StudentHiredRecord,
        | "companyName"
        | "position"
        | "jobType"
        | "howGotJob"
        | "description"
        | "companyCountry"
        | "companyCity"
        | "isCurrentlyWorking"
        | "careerImpactNote"
        | "appointmentLetterUrl"
    >
> & { startDate?: string | null; endDate?: string | null };

export const studentHiredRecordService = {
    list: () => httpClient.get<ApiResponse<StudentHiredRecord[]>>("/student-hired-records").then(unwrapList),
    create: (payload: HiredRecordPayload) =>
        httpClient.post<ApiResponse<StudentHiredRecord>>("/student-hired-records", payload).then(unwrap),
    update: (id: string, payload: HiredRecordPayload) =>
        httpClient.patch<ApiResponse<StudentHiredRecord>>(`/student-hired-records/${id}`, payload).then(unwrap),
    remove: (id: string) => httpClient.delete(`/student-hired-records/${id}`).then(() => undefined),
};

export const studentCourseRequestService = {
    list: () =>
        httpClient.get<ApiResponse<StudentCourseRequest[]>>("/student-course-requests").then(unwrapList),
    create: (payload: { courseName: string; category?: string }) =>
        httpClient.post<ApiResponse<StudentCourseRequest>>("/student-course-requests", payload).then(unwrap),
};
