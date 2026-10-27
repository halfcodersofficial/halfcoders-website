import { Role } from "../lib/roles";

/** The authenticated caller, as resolved from their session (lib/session.ts). */
export interface IRequestUser {
    userId: string;
    sessionId?: string;
    name?: string;
    role: Role;
    email: string;
}
