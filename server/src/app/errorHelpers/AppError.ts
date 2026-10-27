/**
 * An error we threw on purpose. The global handler treats these as expected
 * client rejections: the message is safe to show the user verbatim, even in
 * production, because it was authored here rather than by a library or driver.
 */
class AppError extends Error {
    public statusCode: number;
    public data?: unknown;

    constructor(statusCode: number, message: string, stack = "") {
        super(message);
        this.statusCode = statusCode;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    public setData(data: unknown) {
        this.data = data;
        return this;
    }
}

export default AppError;
