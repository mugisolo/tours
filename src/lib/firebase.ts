import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Configure Google Auth Provider with the approved Google Drive scopes
const provider = new GoogleAuthProvider();
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory access token cache (NEVER stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Boot-time Firestore connectivity validation
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const initAuth = (
  onAuthChange: (user: User | null, accessToken: string | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (!user) {
      cachedAccessToken = null;
      onAuthChange(null, null);
    } else {
      onAuthChange(user, cachedAccessToken);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string | null;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Sanitization helpers strictly matching firebase-blueprint.json & firestore.rules
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned.length > 0 && ID_REGEX.test(cleaned) ? cleaned : 'item-1';
}

export interface SavedTripItinerary {
  id: string;
  ownerId: string;
  title: string;
  stopIds: string[];
  totalDistanceKm: number;
  daysCount: number;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SavedBookmark {
  id: string;
  ownerId: string;
  attractionId: string;
  personalNote: string;
  visited: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function subscribeUserItineraries(
  uid: string,
  onData: (items: SavedTripItinerary[]) => void
) {
  const path = 'itineraries';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedTripItinerary[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SavedTripItinerary, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveTripItineraryToFirestore(params: {
  itineraryId?: string;
  title: string;
  stopIds: string[];
  totalDistanceKm: number;
  daysCount: number;
  notes: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to save itinerary.');

  const docId = sanitizeId(params.itineraryId || `trip-${Date.now()}`);
  const path = `itineraries/${docId}`;

  const safeTitle = (params.title.trim() || 'Uganda Pearl Safari').slice(0, 120);
  const safeStops = params.stopIds
    .map((s) => sanitizeId(s))
    .filter(Boolean)
    .slice(0, 25);
  if (safeStops.length === 0) {
    throw new Error('Itinerary must contain at least 1 stop.');
  }
  const safeDist = Math.max(0, Math.min(50000, Math.round(params.totalDistanceKm)));
  const safeDays = Math.max(1, Math.min(60, Math.round(params.daysCount)));
  const safeNotes = (params.notes || '').slice(0, 1000);

  try {
    await setDoc(doc(db, 'itineraries', docId), {
      ownerId: user.uid,
      title: safeTitle,
      stopIds: safeStops,
      totalDistanceKm: safeDist,
      daysCount: safeDays,
      notes: safeNotes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTripItineraryFromFirestore(itineraryId: string) {
  const docId = sanitizeId(itineraryId);
  const path = `itineraries/${docId}`;
  try {
    await deleteDoc(doc(db, 'itineraries', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserBookmarks(
  uid: string,
  onData: (bookmarks: Record<string, SavedBookmark>) => void
) {
  const path = 'bookmarks';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, SavedBookmark> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as Omit<SavedBookmark, 'id'>;
        map[data.attractionId] = { id: d.id, ...data };
      });
      onData(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function toggleAttractionBookmark(params: {
  attractionId: string;
  existingBookmark?: SavedBookmark;
  personalNote?: string;
  visited?: boolean;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to bookmark attractions.');

  const safeAttractionId = sanitizeId(params.attractionId);
  const docId = sanitizeId(`${user.uid}_${safeAttractionId}`);
  const path = `bookmarks/${docId}`;

  if (params.existingBookmark && params.personalNote === undefined && params.visited === undefined) {
    try {
      await deleteDoc(doc(db, 'bookmarks', params.existingBookmark.id));
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  const safeNote = (params.personalNote ?? params.existingBookmark?.personalNote ?? '').slice(0, 500);
  const safeVisited = params.visited ?? params.existingBookmark?.visited ?? false;

  if (params.existingBookmark) {
    try {
      await updateDoc(doc(db, 'bookmarks', params.existingBookmark.id), {
        personalNote: safeNote,
        visited: safeVisited,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(doc(db, 'bookmarks', docId), {
        ownerId: user.uid,
        attractionId: safeAttractionId,
        personalNote: safeNote,
        visited: safeVisited,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}
