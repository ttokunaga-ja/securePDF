// Concrete Firebase implementation, isolated so the Firebase SDK lands in a
// lazily-loaded chunk (imported only via firebase.ts → dynamic import).
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'

import type { AuthClient, AuthUser, FirebaseWebConfig } from './firebase'

function toUser(u: User | null): AuthUser | null {
  return u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null
}

export function createAuthClient(config: FirebaseWebConfig): AuthClient {
  const app = initializeApp(config)
  const auth = getAuth(app)
  return {
    currentUser: () => toUser(auth.currentUser),
    onChange: (cb) => onAuthStateChanged(auth, (u) => cb(toUser(u))),
    signIn: async () => {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const user = toUser(result.user)
      if (!user) throw new Error('sign-in returned no user')
      return user
    },
    signOut: () => signOut(auth),
    getIdToken: async () => {
      const current = auth.currentUser
      if (!current) throw new Error('not signed in')
      return current.getIdToken()
    },
  }
}
