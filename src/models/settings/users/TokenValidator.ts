import jwt from 'jsonwebtoken';

export default class TokenValidator {
     private secretKey: string | undefined

     constructor() {
          this.secretKey = process.env.ACCESS_TOKEN_SECRET;
     }


     initializeSecretKey(): void {
          if (!this.secretKey) {
               throw new Error('Access token secret key is not defined in environment variables');
          }
     }

     async validateAccessToken(token: string): Promise<{ expired: boolean | undefined } | undefined> {
          try {
               this.initializeSecretKey();
               const verified = jwt.verify(token, this.secretKey as string) as jwt.JwtPayload;
               if (verified?.email) return { expired: false };
               return undefined;
          } catch (error) {
               if (error instanceof jwt.TokenExpiredError) {
                    return { expired: true }
               }
               return undefined;
          }
     }

     async decodeAccessToken(token: string): Promise<jwt.JwtPayload | null> {
          try {
               this.initializeSecretKey();
               const decoded = jwt.verify(token, this.secretKey as string) as jwt.JwtPayload;
               return decoded;
          } catch (error) {
               console.error('Failed to decode access token:', error);
               return null;
          }
     }
}