import { IRequestUser } from "../interfaces/requestUser.interface";
import { Role } from "./roles";

/**
 * What staff may know about a student.
 *
 * A mentor marks work and runs support sessions, and for that they need a
 * student's name. On the courses they teach they also see the roster and
 * each student's progress — with the photo, so they know who's who — but
 * never a way to reach them: email, phone and the rest of the profile stay
 * with admins. Every endpoint a mentor can reach shapes students through
 * here, so the rule lives in one place and holds whatever the client does. A
 * student reading their own rows is not "staff" and is unaffected.
 */
export const seesStudentDetails = (user: IRequestUser) => user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

/** A student as a mentor sees them: the name, and an opaque id to key rows by. */
export const STUDENT_NAME_ONLY = { id: true, name: true } as const;

/** The Prisma `select` for a student: `full` for admins, the name for anyone else. */
export const studentSelectFor = <T extends Record<string, true>>(user: IRequestUser, full: T): T | typeof STUDENT_NAME_ONLY =>
    seesStudentDetails(user) ? full : STUDENT_NAME_ONLY;

/** A student on the roster of a course a mentor teaches: the name and photo — no contact details. */
export const STUDENT_CARD = { id: true, name: true, image: true } as const;

/** The roster's `select`: `full` for admins, the name and photo for a mentor. */
export const studentCardFor = <T extends Record<string, true>>(user: IRequestUser, full: T): T | typeof STUDENT_CARD =>
    seesStudentDetails(user) ? full : STUDENT_CARD;

/** The same rule for a row already loaded with more than that. */
export const nameOnly = <T extends { id: string; name: string }>(student: T) => ({ id: student.id, name: student.name });
