import { LibraryFile } from '../types';

export function getUserInitials(name?: string): string {
  if (!name) return 'EX'; // Default fallback
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EX';
}

export function calculateReadingTime(files: LibraryFile[]): string {
  if (!files || files.length === 0) return '0h';

  // For demo: estimate 1 hour per file with progress
  // In a real app, this would come from actual reading time tracking
  const totalHours = files.reduce((acc, file) => {
    return acc + (file.progress * 1); // Estimate 1 hour per file based on progress
  }, 0);

  return `${totalHours.toFixed(1)}h`;
}

export function calculateStreak(files: LibraryFile[]): number {
  if (!files || files.length === 0) return 0;

  // Simple streak calculation: count consecutive days with file activity
  const today = new Date();
  let streak = 0;

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toDateString();

    // Check if any file was opened on this date
    const hasActivity = files.some(file => {
      if (!file.lastOpenedAt) return false;
      const fileDate = new Date(file.lastOpenedAt);
      return fileDate.toDateString() === dateStr;
    });

    if (hasActivity) {
      streak++;
    } else if (i > 0) {
      break; // Break streak if no activity after first day
    }
  }

  return streak;
}