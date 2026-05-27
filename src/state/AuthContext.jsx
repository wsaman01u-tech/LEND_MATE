import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { serverTimestamp } from '../lib/data';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      console.error('Firebase is not configured. Add VITE_FIREBASE_* env vars.');
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (current) => {
      try {
        setUser(current);
        if (current) {
          try {
            const snap = await getDoc(doc(db, 'users', current.uid));
            setProfile(snap.exists() ? snap.data() : {
              name: current.displayName || current.email || 'Admin',
              email: current.email || '',
            });
          } catch (error) {
            console.warn('Failed to load user profile:', error);
            setProfile({
              name: current.displayName || current.email || 'Admin',
              email: current.email || '',
            });
          }
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isDemo: false,
    async register({ name, email, password, phone }) {
      if (!isFirebaseConfigured) throw new Error('Firebase not configured');
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), { name, email, phone, role: 'Admin', createdAt: serverTimestamp() });
      return cred.user;
    },
    async login(email, password) {
      if (!isFirebaseConfigured) throw new Error('Firebase not configured');
      return signInWithEmailAndPassword(auth, email, password);
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    async logout() {
      return signOut(auth);
    }
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
