/**
 * groupManager.js
 * 
 * Manages collaborative learning groups and shared reflections
 * for the Mini OpenStax educational app.
 * 
 * All data is stored in localStorage—no network calls.
 * Group-based isolation ensures privacy between classes/teams.
 */

// Constants for localStorage keys
const GROUP_KEY = 'miniopenstax_group';
const REFLECTIONS_KEY_PREFIX = 'group_reflections_';
const STUDENT_NAME_KEY = 'student_name';

/**
 * Retrieves the current user's active group name.
 * @returns {string|null} Group name if set, otherwise null.
 */
export function getGroupId() {
  return localStorage.getItem(GROUP_KEY);
}

/**
 * Sets or updates the user's active group name.
 * @param {string} name - The group name (e.g., "Class 8B").
 */
export function setGroupId(name) {
  if (typeof name === 'string' && name.trim()) {
    localStorage.setItem(GROUP_KEY, name.trim());
  }
}

/**
 * Saves a student's reflection for a specific lesson within their group.
 * Reflections are scoped to: [group] + [chapter]
 * @param {number} chapter - The lesson/chapter number (e.g., 261).
 * @param {string} text - The reflection content.
 */
export function saveReflectionToGroup(chapter, text) {
  const groupId = getGroupId();
  const studentName = localStorage.getItem(STUDENT_NAME_KEY) || 'Anonymous';
  
  if (!groupId || !text?.trim()) return;

  const key = `${REFLECTIONS_KEY_PREFIX}${groupId}_${chapter}`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  
  // Avoid duplicate entries (same student + same text)
  const alreadyExists = existing.some(
    item => item.student === studentName && item.text === text.trim()
  );
  
  if (!alreadyExists) {
    existing.push({
      text: text.trim(),
      timestamp: Date.now(),
      student: studentName
    });
    localStorage.setItem(key, JSON.stringify(existing));
  }
}

/**
 * Loads peer reflections for the current group and lesson,
 * excluding the current user's own entries.
 * @param {number} chapter - The lesson/chapter number.
 * @returns {Array} List of reflection objects from peers.
 */
export function loadPeerReflections(chapter) {
  const groupId = getGroupId();
  const myName = localStorage.getItem(STUDENT_NAME_KEY);
  
  if (!groupId) return [];

  const key = `${REFLECTIONS_KEY_PREFIX}${groupId}_${chapter}`;
  const allReflections = JSON.parse(localStorage.getItem(key) || '[]');
  
  // Filter out the current user's reflections
  return allReflections.filter(reflection => reflection.student !== myName);
}

/**
 * Exports the current user's insight (reflection + mastery) as a shareable string.
 * Format: groupId|chapter|timestamp|encodedText|studentName|masteryFlag
 * Designed to be pasted into WhatsApp and imported by peers.
 * @param {number} chapter - Lesson number.
 * @param {boolean} mastery - Whether mastery was achieved (score ≥ 15/20).
 * @returns {string|null} Encoded payload or null if incomplete.
 */
export function exportInsightPayload(chapter, mastery = false) {
  const groupId = getGroupId();
  const studentName = localStorage.getItem(STUDENT_NAME_KEY);
  const reflection = localStorage.getItem(`reflection_${chapter}`);
  
  if (!groupId || !studentName || !reflection) {
    return null; // Incomplete data
  }

  const cleanText = encodeURIComponent(reflection.trim());
  const masteryFlag = mastery ? 'M' : 'N';
  return `${groupId}|${chapter}|${Date.now()}|${cleanText}|${studentName}|${masteryFlag}`;
}

/**
 * Imports a peer's insight from a WhatsApp-shared string.
 * Validates group and chapter before saving.
 * @param {string} payload - The string received via WhatsApp.
 * @param {number} currentChapter - The lesson the user is currently on.
 * @returns {{success: boolean, message: string}}
 */
export function importPeerInsight(payload, currentChapter) {
  try {
    const parts = payload.split('|');
    if (parts.length < 6) {
      return { success: false, message: "Invalid format. Paste the full message." };
    }

    const [importGroupId, chapterStr, timestampStr, encodedText, studentName, masteryFlag] = parts;
    const chapter = parseInt(chapterStr, 10);
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(chapter) || isNaN(timestamp)) {
      return { success: false, message: "Invalid timestamp or chapter." };
    }

    const currentGroup = getGroupId();
    if (importGroupId !== currentGroup) {
      return {
        success: false,
        message: `Insight is for group "${importGroupId}", but you're in "${currentGroup}".`
      };
    }

    if (chapter !== currentChapter) {
      return {
        success: false,
        message: `This insight is from Lesson ${chapter + 1}, but you're on Lesson ${currentChapter + 1}.`
      };
    }

    const text = decodeURIComponent(encodedText);
    if (!text.trim()) {
      return { success: false, message: "Empty reflection text." };
    }

    // Save under the group+chapter key
    const key = `${REFLECTIONS_KEY_PREFIX}${importGroupId}_${chapter}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');

    // Avoid duplicates
    const exists = existing.some(
      r => r.student === studentName && r.text === text
    );

    if (!exists) {
      existing.push({
        text,
        timestamp,
        student: studentName,
        mastery: masteryFlag === 'M'
      });
      localStorage.setItem(key, JSON.stringify(existing));
      return { success: true, message: "Peer insight added successfully!" };
    } else {
      return { success: false, message: "Already imported this insight." };
    }

  } catch (error) {
    console.error("Import error:", error);
    return { success: false, message: "Failed to parse. Share via WhatsApp exactly as sent." };
  }
}
