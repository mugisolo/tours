import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  SavedTripItinerary,
  deleteTripItineraryFromFirestore,
  saveTripItineraryToFirestore,
  googleSignIn,
  logout,
} from '../lib/firebase';
import { Attraction } from '../data/ugandaAttractions';
import {
  Cloud,
  FolderOpen,
  FileJson,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  X,
  ExternalLink,
  Save,
} from 'lucide-react';

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface CloudDriveModalProps {
  user: User | null;
  accessToken: string | null;
  onAuthUpdated: (user: User, token: string | null) => void;
  savedItineraries: SavedTripItinerary[];
  currentTripStops: Attraction[];
  totalTripDistanceKm: number;
  onLoadItineraryStops: (stopIds: string[]) => void;
  onImportCustomAttractions: (imported: Attraction[]) => void;
  onClose: () => void;
}

const PROMPT_DRIVE_FOLDER_ID = '1zvNrE4Vf8ZDPnXb95X4H7JMgXAUKRQY3';

export const CloudDriveModal: React.FC<CloudDriveModalProps> = ({
  user,
  accessToken,
  onAuthUpdated,
  savedItineraries,
  currentTripStops,
  totalTripDistanceKm,
  onLoadItineraryStops,
  onImportCustomAttractions,
  onClose,
}) => {
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveFolderMode, setDriveFolderMode] = useState<'utaFolder' | 'myDrive'>(
    'utaFolder'
  );
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [tripTitle, setTripTitle] = useState('Uganda Pearl Circuit');
  const [tripNotes, setTripNotes] = useState(
    'Custom multi-day safari & cultural heritage route across Uganda.'
  );
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isExportingDrive, setIsExportingDrive] = useState(false);

  // Mandatory Confirmation Dialog State before any destructive / overwrite action
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const handleSignIn = async () => {
    try {
      setStatusMessage(null);
      const res = await googleSignIn();
      onAuthUpdated(res.user, res.accessToken);
      setStatusMessage({
        type: 'success',
        text: 'Connected to Google Account & Google Drive API.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Google Sign-In was cancelled or failed.',
      });
    }
  };

  const fetchDriveFiles = useCallback(async () => {
    if (!accessToken) return;
    setLoadingDrive(true);
    setStatusMessage(null);

    try {
      const q =
        driveFolderMode === 'utaFolder'
          ? `'${PROMPT_DRIVE_FOLDER_ID}' in parents and trashed = false`
          : `(mimeType = 'application/json' or name contains 'uganda' or name contains 'itinerary') and trashed = false`;

      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', q);
      url.searchParams.set(
        'fields',
        'files(id, name, mimeType, modifiedTime, webViewLink)'
      );
      url.searchParams.set('pageSize', '25');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      url.searchParams.set('supportsAllDrives', 'true');

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        setStatusMessage({
          type: 'error',
          text: 'Your Google Drive session token expired or lacks permission for this folder. Click "Reconnect Google Drive" to refresh scopes.',
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Google Drive API returned ${response.status}`);
      }

      const data = await response.json();
      setDriveFiles(data.files || []);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Could not list files from Google Drive.',
      });
    } finally {
      setLoadingDrive(false);
    }
  }, [accessToken, driveFolderMode]);

  useEffect(() => {
    if (accessToken) {
      fetchDriveFiles();
    }
  }, [accessToken, fetchDriveFiles]);

  const handleImportFromDriveFile = async (file: DriveFileItem) => {
    if (!accessToken) return;
    setStatusMessage({
      type: 'info',
      text: `Downloading "${file.name}" from Google Drive...`,
    });

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to read file content (${response.status})`);
      }

      const json = await response.json();
      const rawArray = Array.isArray(json)
        ? json
        : Array.isArray(json.attractions)
        ? json.attractions
        : null;

      if (rawArray && rawArray.length > 0 && rawArray[0].name && rawArray[0].lat) {
        onImportCustomAttractions(rawArray as Attraction[]);
        setStatusMessage({
          type: 'success',
          text: `Imported ${rawArray.length} Uganda destinations from "${file.name}"!`,
        });
      } else if (Array.isArray(json.stopIds)) {
        onLoadItineraryStops(json.stopIds);
        setStatusMessage({
          type: 'success',
          text: `Loaded trip itinerary "${json.title || file.name}" (${
            json.stopIds.length
          } stops).`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `"${file.name}" does not match the Uganda Attractions or Trip Itinerary JSON schema.`,
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Failed to parse JSON file from Google Drive.',
      });
    }
  };

  const handleSaveTripToFirestore = async () => {
    if (!user) {
      setStatusMessage({
        type: 'error',
        text: 'Please sign in with Google first to save trips to your account.',
      });
      return;
    }
    if (currentTripStops.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Add at least 1 destination stop to your trip before saving.',
      });
      return;
    }

    setIsSavingCloud(true);
    setStatusMessage(null);
    try {
      await saveTripItineraryToFirestore({
        title: tripTitle,
        stopIds: currentTripStops.map((s) => s.id),
        totalDistanceKm: totalTripDistanceKm,
        daysCount: currentTripStops.length,
        notes: tripNotes,
      });
      setStatusMessage({
        type: 'success',
        text: `Saved "${tripTitle}" to your cloud account.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Failed to save itinerary to cloud.',
      });
    } finally {
      setIsSavingCloud(false);
    }
  };

  const executeExportTripToDrive = async () => {
    if (!accessToken) {
      setStatusMessage({
        type: 'error',
        text: 'Please connect Google Drive first to export your itinerary.',
      });
      return;
    }
    if (currentTripStops.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Your current trip is empty. Add stops on the map first.',
      });
      return;
    }

    setIsExportingDrive(true);
    setStatusMessage(null);

    try {
      const payload = {
        title: tripTitle,
        exportedAt: new Date().toISOString(),
        totalDistanceKm: totalTripDistanceKm,
        daysCount: currentTripStops.length,
        notes: tripNotes,
        stopIds: currentTripStops.map((s) => s.id),
        stops: currentTripStops.map((s, idx) => ({
          day: idx + 1,
          id: s.id,
          name: s.name,
          category: s.category,
          region: s.region,
          lat: s.lat,
          lng: s.lng,
          bestTimeToVisit: s.bestTimeToVisit,
          entryFeePermits: s.entryFeePermits,
        })),
      };

      const fileName = `${tripTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-uganda-itinerary.json`;

      const metadata = {
        name: fileName,
        mimeType: 'application/json',
      };

      const boundary = '-------UgandaPearlDriveBoundary314159';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(payload, null, 2) +
        closeDelimiter;

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!response.ok) {
        throw new Error(`Google Drive upload failed (${response.status})`);
      }

      const created = await response.json();
      setStatusMessage({
        type: 'success',
        text: `Exported "${created.name}" to your Google Drive!`,
      });
      fetchDriveFiles();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Failed to upload itinerary to Google Drive.',
      });
    } finally {
      setIsExportingDrive(false);
    }
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const arr = Array.isArray(json)
          ? json
          : Array.isArray(json.attractions)
          ? json.attractions
          : null;
        if (arr && arr.length > 0 && arr[0].name && arr[0].lat) {
          onImportCustomAttractions(arr as Attraction[]);
          setStatusMessage({
            type: 'success',
            text: `Imported ${arr.length} attractions from local file "${file.name}".`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Uploaded JSON does not contain a valid attractions array.',
          });
        }
      } catch {
        setStatusMessage({
          type: 'error',
          text: 'Invalid JSON file format.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-drive-modal-title"
    >
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="cloud-drive-modal-title"
                className="text-base font-bold leading-snug"
              >
                Google Drive Dataset Sync & Cloud Trip Manager
              </h2>
              <p className="text-xs text-stone-300">
                Browse UTA Drive folder ({PROMPT_DRIVE_FOLDER_ID.slice(0, 12)}…),
                import custom JSON datasets, or sync itineraries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-3 text-xs font-medium flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800'
                : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Authentication Row */}
          <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-10 h-10 rounded-full border border-stone-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-700 text-white flex items-center justify-center font-bold text-sm">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {user.displayName || 'Authenticated Explorer'}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {user.email} ·{' '}
                    {accessToken
                      ? 'Google Drive Scope Active'
                      : 'Cloud Account Active (Click Reconnect for Drive API)'}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Connect Google Workspace & Cloud Sync
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-300">
                  Sign in with Google to browse the UTA Google Drive folder,
                  export itineraries to Drive, and sync trips across devices.
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              {!user || !accessToken ? (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="gsi-material-button"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        ></path>
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        ></path>
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        ></path>
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        ></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">
                      {user ? 'Reconnect Google Drive' : 'Sign in with Google'}
                    </span>
                  </div>
                </button>
              ) : null}

              {user && (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Save / Export Active Trip & Firestore Saved Trips */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 space-y-3">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Save className="w-4 h-4 text-amber-600" />
                  Save or Export Current Trip ({currentTripStops.length} Stops ·{' '}
                  {totalTripDistanceKm.toLocaleString()} km)
                </h3>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Trip Title
                  </label>
                  <input
                    type="text"
                    value={tripTitle}
                    onChange={(e) => setTripTitle(e.target.value)}
                    maxLength={120}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100"
                    placeholder="e.g., 7-Day Primate & Nile Circuit"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Trip Notes
                  </label>
                  <textarea
                    value={tripNotes}
                    onChange={(e) => setTripNotes(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSavingCloud || currentTripStops.length === 0}
                    onClick={handleSaveTripToFirestore}
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    {isSavingCloud ? 'Saving...' : 'Save to Cloud Account'}
                  </button>

                  <button
                    type="button"
                    disabled={isExportingDrive || currentTripStops.length === 0}
                    onClick={() =>
                      setConfirmAction({
                        title: 'Export Itinerary to Google Drive',
                        description: `This will create a new JSON file "${tripTitle
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')}-uganda-itinerary.json" in your Google Drive with ${
                          currentTripStops.length
                        } stops.`,
                        confirmLabel: 'Confirm Upload to Drive',
                        onConfirm: executeExportTripToDrive,
                      })
                    }
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isExportingDrive ? 'Uploading...' : 'Export to Google Drive'}
                  </button>
                </div>
              </div>

              {/* Saved Cloud Itineraries List */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Saved Cloud Itineraries ({savedItineraries.length})
                </h3>
                {savedItineraries.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    No saved cloud itineraries yet. Build a route on the map and
                    click &ldquo;Save to Cloud Account&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {savedItineraries.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400">
                            {item.stopIds.length} stops ·{' '}
                            {item.totalDistanceKm.toLocaleString()} km
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onLoadItineraryStops(item.stopIds);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                title: 'Delete Saved Itinerary',
                                description: `Are you sure you want to permanently delete "${item.title}" from your account?`,
                                confirmLabel: 'Delete Permanently',
                                onConfirm: async () => {
                                  await deleteTripItineraryFromFirestore(item.id);
                                  setStatusMessage({
                                    type: 'info',
                                    text: `Deleted itinerary "${item.title}".`,
                                  });
                                },
                              })
                            }
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                            aria-label={`Delete ${item.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Google Drive Folder Browser & Local Dataset Import */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-amber-600" />
                    Google Drive Explorer
                  </h3>
                  {accessToken && (
                    <button
                      type="button"
                      onClick={fetchDriveFiles}
                      disabled={loadingDrive}
                      className="px-2.5 py-1 rounded border border-stone-300 dark:border-stone-600 text-xs font-medium flex items-center gap-1 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          loadingDrive ? 'animate-spin' : ''
                        }`}
                      />
                      Refresh
                    </button>
                  )}
                </div>

                {/* Folder Mode Switcher */}
                <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDriveFolderMode('utaFolder')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      driveFolderMode === 'utaFolder'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                        : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    UTA Shared Folder (1zvNrE4V…)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriveFolderMode('myDrive')}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      driveFolderMode === 'myDrive'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                        : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    My Drive JSON / Trips
                  </button>
                </div>

                {!accessToken ? (
                  <div className="py-8 text-center text-xs text-stone-500 dark:text-stone-400 space-y-2">
                    <p>
                      Connect your Google Account above to list files inside the
                      UTA Google Drive folder or your own Drive.
                    </p>
                  </div>
                ) : loadingDrive ? (
                  <div className="py-8 text-center text-xs text-stone-500">
                    Loading files from Google Drive...
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="py-6 text-center text-xs text-stone-500 dark:text-stone-400 space-y-1">
                    <p>No JSON or dataset files found in this view.</p>
                    <p className="text-[11px]">
                      Switch tabs above or export a trip itinerary to see it
                      listed here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileJson className="w-4 h-4 text-amber-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                              {file.name}
                            </div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {file.mimeType}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded text-stone-500 hover:text-stone-900 dark:hover:text-white"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleImportFromDriveFile(file)}
                            className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            Load
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Local JSON Dataset Upload Fallback */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 space-y-2">
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Import Custom Attractions Dataset (Local JSON)
                </h4>
                <p className="text-[11px] text-stone-600 dark:text-stone-300">
                  Have a local `ATTRACTIONS` JSON dataset exported from the UTA
                  Drive folder? Upload it here to dynamically map and explore it.
                </p>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select JSON File</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleLocalFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Mandatory Destructive / Mutating Operation Confirmation Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {confirmAction.title}
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                    {confirmAction.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const fn = confirmAction.onConfirm;
                    setConfirmAction(null);
                    await fn();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
