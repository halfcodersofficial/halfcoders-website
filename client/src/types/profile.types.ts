/**
 * The student "View Profile" module — additional info, address, education,
 * important links + portfolio projects, skills, job profile/experience,
 * hired records and course requests. Mirrors `studentProfile.prisma` on the
 * server; every optional field is `T | null` (never `undefined`), matching
 * `domain.types.ts` convention.
 */

export type Gender = "MALE" | "FEMALE";

export interface StudentAdditionalInfo {
    gender: Gender | null;
    ageRange: string | null;
    primaryDeviceType: string | null;
    internetType: string | null;
    yearsOfExperience: string | null;
    employmentRole: string | null;
    areaType: string | null;
}

export interface StudentAddress {
    presentCountry: string | null;
    presentDistrict: string | null;
    presentStreetAddress: string | null;
    permanentCountry: string | null;
    permanentDistrict: string | null;
    permanentStreetAddress: string | null;
    sameAsPresent: boolean;
}

export interface StudentEducation {
    level: string | null;
    examTitle: string | null;
    institutionName: string | null;
    passingYear: number | null;
    isCurrentlyStudying: boolean;
    currentYear: string | null;
    /** Null = unanswered, distinct from "No". */
    isCseStudent: boolean | null;
}

/** The five singleton link fields. Portfolio project cards are `StudentProject`. */
export interface StudentLinks {
    cvUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    profileImageUrl: string | null;
}

export interface StudentJobProfile {
    wantsJob: boolean | null;
    jobType: string | null;
    jobPreference: string | null;
    wantsJobOutsideBangladesh: boolean | null;
    hasJobExperience: boolean | null;
}

export interface StudentProject {
    id: string;
    title: string;
    description: string | null;
    url: string;
    order: number;
}

export interface StudentSkill {
    id: string;
    name: string;
    yearsOfExperience: string | null;
    projectLink: string | null;
    order: number;
}

export interface StudentJobExperience {
    id: string;
    designation: string;
    companyName: string;
    isRelatedToIt: boolean | null;
    description: string | null;
    isCurrentlyWorking: boolean;
    startDate: string | null;
    endDate: string | null;
    order: number;
}

export interface StudentHiredRecord {
    id: string;
    companyName: string;
    position: string;
    jobType: string | null;
    howGotJob: string | null;
    description: string | null;
    companyCountry: string | null;
    companyCity: string | null;
    isCurrentlyWorking: boolean;
    startDate: string | null;
    endDate: string | null;
    /** "How did Half Coders help you build your career?" free text. */
    careerImpactNote: string | null;
    appointmentLetterUrl: string | null;
    order: number;
}

export type CourseRequestStatus = "PENDING" | "REVIEWED" | "FULFILLED" | "DECLINED";

export interface StudentCourseRequest {
    id: string;
    courseName: string;
    category: string | null;
    status: CourseRequestStatus;
    createdAt: string;
}

/** Which of the 7 scored sections are complete — backs the completion bar. */
export interface ProfileSectionFlags {
    myProfile: boolean;
    additionalInfo: boolean;
    address: boolean;
    education: boolean;
    importantLinks: boolean;
    skillSet: boolean;
    jobProfile: boolean;
}

/** Everything the My Profile page and the sidebar completion bar need in one call. */
export interface ProfileOverview {
    profile: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        whatsapp: string | null;
        studentId: string | null;
        image: string | null;
        role: string;
        createdAt: string;
    };
    additionalInfo: StudentAdditionalInfo | null;
    address: StudentAddress | null;
    education: StudentEducation | null;
    links: StudentLinks | null;
    jobProfile: StudentJobProfile | null;
    counts: {
        projects: number;
        skills: number;
        jobExperiences: number;
        hiredRecords: number;
        courseRequests: number;
    };
    completionPercent: number;
    sections: ProfileSectionFlags;
}
