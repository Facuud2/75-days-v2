const TUTORIAL_SEEN_PREFIX = '75days:tutorial-seen:';
const TUTORIAL_PENDING_PREFIX = '75days:tutorial-pending:';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getTutorialSeenKey(userId: string): string {
  return `${TUTORIAL_SEEN_PREFIX}${userId}`;
}

export function getTutorialPendingKey(userId: string): string {
  return `${TUTORIAL_PENDING_PREFIX}${userId}`;
}

export function hasSeenTutorial(userId?: string | null): boolean {
  if (!userId) return true;
  const storage = getStorage();
  if (!storage) return true;
  return storage.getItem(getTutorialSeenKey(userId)) === 'true';
}

export function markTutorialSeen(userId?: string | null): void {
  if (!userId) return;
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(getTutorialSeenKey(userId), 'true');
  storage.removeItem(getTutorialPendingKey(userId));
}

export function setPendingTutorial(userId?: string | null): void {
  if (!userId) return;
  const storage = getStorage();
  if (!storage) return;
  if (!hasSeenTutorial(userId)) {
    storage.setItem(getTutorialPendingKey(userId), 'true');
  }
}

export function isTutorialPending(userId?: string | null): boolean {
  if (!userId) return false;
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(getTutorialPendingKey(userId)) === 'true' && !hasSeenTutorial(userId);
}

export function resetAndQueueTutorial(userId?: string | null): void {
  if (!userId) return;
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(getTutorialSeenKey(userId));
  storage.setItem(getTutorialPendingKey(userId), 'true');
}
