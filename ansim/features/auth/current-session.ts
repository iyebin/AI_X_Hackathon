import AsyncStorage from '@react-native-async-storage/async-storage';

let currentGuardianId: number | undefined;
let currentGuardianName: string | undefined;
const SESSION_STORAGE_KEY = '@ansim/auth-session';

export type SavedSession = {
  role: 'guardian' | 'protected';
  userId: number;
  userName: string;
  protectorPhone?: string;
};

export function setCurrentGuardian(guardianId: number, guardianName: string) {
  currentGuardianId = guardianId;
  currentGuardianName = guardianName;
}

export function getCurrentGuardianId() {
  return currentGuardianId;
}

export function getCurrentGuardianName() {
  return currentGuardianName;
}

export function clearCurrentGuardianId() {
  currentGuardianId = undefined;
  currentGuardianName = undefined;
}

export async function saveSession(session: SavedSession) {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function getSavedSession(): Promise<SavedSession | null> {
  const value = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!value) return null;

  try {
    const session: unknown = JSON.parse(value);
    if (
      typeof session !== 'object' ||
      session === null ||
      !('role' in session) ||
      !('userId' in session) ||
      !('userName' in session) ||
      ((session as SavedSession).role !== 'guardian' && (session as SavedSession).role !== 'protected') ||
      !Number.isInteger((session as SavedSession).userId) ||
      typeof (session as SavedSession).userName !== 'string'
    ) {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session as SavedSession;
  } catch {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function clearSavedSession() {
  clearCurrentGuardianId();
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}
