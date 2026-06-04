// web/src/auth/AuthPort.ts
export interface Session {
  userId: string;
  email: string | null;
}

export interface AuthPort {
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<void>; // throws on bad credentials
  signOut(): Promise<void>;
  onAuthChange(cb: (session: Session | null) => void): () => void; // returns unsubscribe
}
