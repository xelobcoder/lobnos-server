export class SecurityError extends Error {
     constructor(
          message: string,
          public code: string,
          public statusCode: number = 500
     ) {
          super(message);
          this.name = 'SecurityError';
          Object.setPrototypeOf(this, SecurityError.prototype);
     }
}


export class UnauthorizedSessionError extends SecurityError {
     constructor() {
          super(
               'Unauthorized session',
               'UNAUTHORIZED_SESSION',
               401
          );
          Object.setPrototypeOf(this, UnauthorizedSessionError.prototype);
     }
}


export class UnFoundSessionError extends SecurityError {
     constructor(employeeid: number, tenantId: number) {
          super(
               `Session not found for employeeid ${employeeid} and tenantId ${tenantId}`,
               'SESSION_CODE_NOT_FOUND',
               404
          );
          Object.setPrototypeOf(this, UnFoundSessionError.prototype);
     }
}



export class SessionCreationError extends SecurityError {
     constructor(employeeid: number, tenantId: number) {
          super(
               `Error Creating sesssion for ${employeeid}`,
               `SESSION_CREATION_ERROR`,
               500
          )
     }
}
