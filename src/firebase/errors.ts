import type { User } from "firebase/auth";

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  auth: User | null;

  constructor(context: SecurityRuleContext, auth: User | null = null) {
    const message = `Firestore Permission Denied: The following request was denied by Firestore Security Rules:
{
  "auth": ${JSON.stringify(auth, null, 2)},
  "method": "${context.operation}",
  "path": "/databases/(default)/documents/${context.path}"
  ${context.requestResourceData ? `,"resource": ${JSON.stringify(context.requestResourceData, null, 2)}` : ''}
}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    this.auth = auth;
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }
}
