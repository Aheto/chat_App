/**
 * chatLogic.js
 * 
 * Core application logic for Mini OpenStax:
 * - Quiz evaluation & mastery tracking
 * - Analytics (anonymous, opt-in)
 * - WhatsApp-based sharing
 * - Integration with groupManager for collaborative features
 */

import {
  exportInsightPayload,
  importPeerInsight
} from './groupManager.js';

// Constants
const WHATSAPP_NUMBER = "233257320201"; // Ghana number
const ANALYTICS_CONSENT_KEY = 'miniopenstax_analytics_consent';
const EVENTS_STORAGE_KEY = 'miniopenstax_events';
const STUDENT_NAME_KEY = 'student_name';

// ======================
// 📊 Analytics System
// ======================

/**
 * Checks if user has opted into anonymous analytics.
 * Instructors auto-opt-in (as per your design).
 */
export function isAnalyticsEnabled() {
  return localStorage.getItem(ANALYTICS_CONSENT_KEY) === '1';
}

/**
 * Enables analytics consent (e.g., when instructor mode is selected).
 */
export function enableAnalytics() {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, '1');
}

/**
 * Logs a structured event for later batch-sending via WhatsApp.
 * Only stores if analytics are enabled.
 */
export function logEvent(eventType, data = {}) {
  if (!isAnalyticsEnabled()) return;

  const event = {
    type: eventType,
    timestamp: Date.now(),
    lesson: data.lesson || 'unknown',
    data: data
  };

  const events = JSON.parse(localStorage.getItem(EVENTS_STORAGE_KEY) || '[]');
  events.push(event);
  localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));

  // Auto-send when buffer reaches 20 events
  if (events.length >= 20) {
    sendAnalyticsEvents();
  }
}

/**
 * Sends all stored analytics events via WhatsApp as a human-readable summary.
 */
export function sendAnalyticsEvents() {
  const events = JSON.parse(localStorage.getItem(EVENTS_STORAGE_KEY) || '[]');
  if (events.length === 0) return;

  const lessonsAttempted = [...new Set(
    events.map(e => e.lesson).filter(l => l !== 'dashboard' && !isNaN(l))
  )].length;

  const quizzesSubmitted = events.filter(e => e.type === 'quiz_submitted').length;
  const masteryAchieved = events.filter(e => e.type === 'mastery_achieved').length;

  const first = new Date(events[0].timestamp).toISOString().split('T')[0];
  const last = new Date(events[events.length - 1].timestamp).toISOString().split('T')[0];

  const report = `*Mini OpenStax — Anonymous Usage Report*\n` +
    `Lessons Tried: ${lessonsAttempted}\n` +
    `Quizzes Taken: ${quizzesSubmitted}\n` +
    `Mastery Achieved: ${masteryAchieved}\n` +
    `Period: ${first} to ${last}\n\n` +
    `Report generated locally. No personal data shared.`;

  localStorage.removeItem(EVENTS_STORAGE_KEY);

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(report)}`;
  window.open(url, '_blank');
}

// ======================
// 🧠 Quiz & Mastery Logic
// ======================

/**
 * Evaluates quiz answers against correct map.
 * @param {Array} answers - User-selected option IDs (length = 20).
 * @param {Object} correctMap - Mapping from question ID to correct option ID.
 * @param {Array} assessmentItems - Full question objects.
 * @returns {Object} { score, correctList, incorrectList, mastery }
 */
export function evaluateQuiz(answers, correctMap, assessmentItems) {
  let correctCount = 0;
  const correctList = [];
  const incorrectList = [];

  assessmentItems.forEach((item, i) => {
    const userAnswer = answers[i];
    const correctId = correctMap[item.id];
    const correctOpt = item.options.find(o => o.id === correctId);
    const isCorrect = userAnswer === correctId;

    if (isCorrect) {
      correctCount++;
      correctList.push({
        id: item.id,
        prompt: item.prompt,
        answer: correctOpt.text
      });
    } else {
      const userOpt = item.options.find(o => o.id === userAnswer);
      incorrectList.push({
        id: item.id,
        prompt: item.prompt,
        userAnswer: userOpt?.text || '—',
        correctAnswer: correctOpt.text
      });
    }
  });

  const score = correctCount;
  const mastery = score >= 15; // 75% threshold

  return { score, correctList, incorrectList, mastery };
}

/**
 * Generates a WhatsApp-ready performance report.
 * Saves mastery status and reflection in localStorage.
 */
export function generateQuizReport(currentChapter, results, timeOnTask, attempts, reflection = '') {
  const { score, mastery, correctList, incorrectList } = results;
  const total = 20;
  const studentName = localStorage.getItem(STUDENT_NAME_KEY) || '[Name]';

  // Save state
  localStorage.setItem(`mastery_${currentChapter}`, mastery ? '1' : '0');
  localStorage.setItem(`quiz_attempts_${currentChapter}`, String(attempts));

  // Build message
  let report = `*Mini OpenStax — Lesson ${currentChapter + 1}*\n`;
  report += `Student: ${studentName}\n`;
  report += `Score: ${score}/${total} (${Math.round((score / total) * 100)}%) — `;
  report += mastery ? '✅ MASTERED' : '❌ Needs Review';
  report += `\nTime: ${timeOnTask}s | Attempts: ${attempts}\n`;

  if (reflection) {
    report += `\n📝 Reflection:\n"${reflection}"\n`;
  }

  report += `\n`;
  if (correctList.length) {
    report += `✅ CORRECT (${correctList.length}):\n`;
    report += correctList.map(q => `${q.id}. ${q.prompt} → ${q.answer}`).join('\n') + '\n\n';
  }
  if (incorrectList.length) {
    report += `❌ INCORRECT (${incorrectList.length}):\n`;
    report += incorrectList.map(q =>
      `${q.id}. ${q.prompt} → Your answer: ${q.userAnswer} | Correct: ${q.correctAnswer}`
    ).join('\n') + '\n\n';
  }

  report += `Report generated via Mini OpenStax.`;

  // Store for potential re-send
  const timestamp = Date.now();
  localStorage.setItem(`saved_report_${currentChapter}_${timestamp}`, report);

  return report;
}

// ======================
// 📲 WhatsApp Sharing
// ======================

/**
 * Opens WhatsApp with a pre-filled message (report or insight).
 * @param {string} message - Plain or formatted text.
 */
export function shareViaWhatsApp(message) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

/**
 * Exports current user's insight (reflection + mastery) for group sharing.
 * Uses groupManager’s payload generator.
 */
export function exportMyInsights(currentChapter, mastery = false) {
  const payload = exportInsightPayload(currentChapter, mastery);
  if (!payload) {
    alert("Join a group and complete your reflection first.");
    return;
  }

  const message = `*Mini OpenStax — Group Insight*\n\n${payload}\n\n(Share this with your group!)`;
  shareViaWhatsApp(message);
}

/**
 * Imports peer insight from raw text (e.g., pasted from WhatsApp).
 * Delegates validation and storage to groupManager.
 */
export function handlePeerImport(rawText, currentChapter) {
  // Extract payload if wrapped in WhatsApp formatting
  const match = rawText.match(/\*Mini OpenStax — Group Insight\*\s*\n\n([^\n]+)/);
  const payload = match ? match[1] : rawText.trim();

  if (!payload) {
    alert("Paste the full message received via WhatsApp.");
    return;
  }

  const result = importPeerInsight(payload, currentChapter);
  alert(result.message);
  return result.success;
}
