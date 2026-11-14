/**
 * Firestore Security Rules Adversarial Test Suite ("Dirty Dozen" Verification)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/itineraries/trip_01',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      ownerId: 'user_victim',
      title: 'Pearl Safari',
      stopIds: ['bwindi-np'],
      totalDistanceKm: 450,
      daysCount: 3,
      notes: 'Gorilla trek',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/itineraries/trip_02',
    auth: { uid: 'user_alpha', email_verified: false },
    payload: {
      ownerId: 'user_alpha',
      title: 'Pearl Safari',
      stopIds: ['bwindi-np'],
      totalDistanceKm: 450,
      daysCount: 3,
      notes: 'Gorilla trek',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: '/itineraries/trip_03',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      ownerId: 'user_alpha',
      title: 'Pearl Safari',
      stopIds: ['bwindi-np'],
      totalDistanceKm: 450,
      daysCount: 3,
      notes: 'Gorilla trek',
      isAdmin: true,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Update',
    operation: 'update',
    path: '/itineraries/trip_01',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      title: 'Updated Safari',
      isVerified: true,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Hijack on Update',
    operation: 'update',
    path: '/itineraries/trip_01',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      ownerId: 'user_beta',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immortal Field Mutation (createdAt)',
    operation: 'update',
    path: '/itineraries/trip_01',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client Timestamp Spoofing',
    operation: 'update',
    path: '/itineraries/trip_01',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      title: 'Forged Time Trip',
      updatedAt: '2099-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Denial-of-Wallet Oversized String',
    operation: 'create',
    path: '/itineraries/trip_08',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      ownerId: 'user_alpha',
      title: 'A'.repeat(500),
      stopIds: ['bwindi-np'],
      totalDistanceKm: 100,
      daysCount: 2,
      notes: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unbounded Array Injection',
    operation: 'create',
    path: '/itineraries/trip_09',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      ownerId: 'user_alpha',
      title: 'Too Many Stops',
      stopIds: new Array(30).fill('bwindi-np'),
      totalDistanceKm: 100,
      daysCount: 2,
      notes: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/itineraries/bad$id!with spaces',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      ownerId: 'user_alpha',
      title: 'Valid Title',
      stopIds: ['bwindi-np'],
      totalDistanceKm: 100,
      daysCount: 2,
      notes: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant Read/Get on Bookmark',
    operation: 'get',
    path: '/bookmarks/bm_victim_1',
    auth: { uid: 'user_attacker', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket Unfiltered List Query',
    operation: 'list',
    path: '/itineraries',
    auth: { uid: 'user_attacker', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
