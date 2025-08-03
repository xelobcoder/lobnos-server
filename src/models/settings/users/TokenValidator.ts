import jwt from 'jsonwebtoken';

export default class TokenValidator {
     private secretKey: string;

     constructor() {
          this.secretKey = process.env.ACCESS_TOKEN_SECRET;
     }

     async validateAccessToken(token: string): Promise<{ expired: boolean | undefined }> {
          try {
               jwt.verify(token, this.secretKey);
               return { expired: false }
          } catch (error) {
               if (error instanceof jwt.TokenExpiredError) {
                    return { expired: true }
               }
               return undefined;
          }
     }

     async decodeAccessToken(token: string): Promise<any> {
          try {
               const decoded = jwt.verify(token, this.secretKey);
               return decoded;
          } catch (error) {
               console.error('Failed to decode access token:', error);
               return null;
          }
     }
}