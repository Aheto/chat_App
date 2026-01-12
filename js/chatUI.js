/**
 * chatUI.js
 * 
 * User interface controller for Mini OpenStax.
 * Handles DOM updates, event binding, and view transitions
 * based on user state (name, group, lesson progress).
 */

import {
  getGroupId,
  setGroupId,
  saveReflectionToGroup,
  loadPeerReflections
} from './groupManager.js';

import {
  exportMyInsights,
  handlePeerImport,
  logEvent
} from './chatLogic.js';

// Constants
const STUDENT_NAME_KEY = 'student_name';
const USER_ROLE_KEY = 'user_role';

// ======================
// 🧩 Utility Functions
// ======================

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function toggleElement(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

// ======================
// 👤 Name & Role Setup
// ======================

/**
 * Initializes the student name prompt if not already set.
 * Used on both index.html and lesson pages.
 */
export function initNamePrompt(onComplete) {
  const savedName = localStorage.getItem(STUDENT_NAME_KEY);
  const namePrompt = document.getElementById('student-name-prompt');
  
  if (!savedName) {
    showElement('student-name-prompt');
    hideElement('group-section');
    hideElement('reflection-prompt');
    hideElement('quiz-container');

    document.getElementById('save-first')?.addEventListener('click', () => {
      const nameInput = document.getElementById('student-name');
      const name = nameInput?.value.trim();
      const isTeacher = document.getElementById('teacher-mode')?.checked || false;

      if (!name) {
        alert("Please enter your name.");
        return;
      }

      localStorage.setItem(STUDENT_NAME_KEY, name);
      localStorage.setItem(USER_ROLE_KEY, isTeacher ? 'instructor' : 'student');
      
      // Auto-enable analytics for instructors
      if (isTeacher) {
        import('./chatLogic.js').then(module => module.enableAnalytics());
      }

      logEvent('lesson_start', {});

      if (namePrompt) namePrompt.style.display = 'none';
      if (onComplete) onComplete();
    });
  } else {
    hideElement('student-name-prompt');
    if (onComplete) onComplete();
  }
}

// ======================
// 👥 Group Management UI
// ======================

/**
 * Initializes the group join/create section.
 * @param {number|null} currentChapter - Null on dashboard, number on lesson pages.
 */
export function initGroupSection(currentChapter = null) {
  const groupId = getGroupId();
  const groupDisplay = document.getElementById('group-display');
  const groupStatus = document.getElementById('group-status') || document.getElementById('group-display');
  const joinBtn = document.getElementById('join-group-btn');

  if (groupId) {
    if (groupDisplay) groupDisplay.textContent = `Group: ${groupId}`;
    if (groupStatus) groupStatus.innerHTML = `<div class="group-card">You're in group: <strong>${groupId}</strong></div>`;
    if (joinBtn) joinBtn.textContent = "✏️ Change Group";
  } else {
    if (groupDisplay) groupDisplay.textContent = "";
    if (groupStatus) groupStatus.innerHTML = '<em>Join a group to share insights!</em>';
    if (joinBtn) joinBtn.textContent = "➕ Join or Create Group";
  }

  if (joinBtn) {
    joinBtn.onclick = () => {
      const name = prompt("Enter your group name (e.g., Class 8B):");
      if (name && name.trim()) {
        setGroupId(name.trim());
        location.reload(); // Simplest way to refresh UI state
      }
    };
  }
}

// ======================
// 💭 Reflection & Peer UI
// ======================

/**
 * Initializes the reflection and peer collaboration section on lesson pages.
 * @param {number} currentChapter - The active lesson number.
 */
export function initReflectionUI(currentChapter) {
  const savedName = localStorage.getItem(STUDENT_NAME_KEY);
  const groupId = getGroupId();
  const reflectionDiv = document.getElementById('reflection-prompt');
  const quizDiv = document.getElementById('quiz-container');

  if (!savedName || !groupId) {
    hideElement('reflection-prompt');
    return;
  }

  showElement('reflection-prompt');
  hideElement('quiz-container');

  // Set reflection question
  const questionEl = document.getElementById('reflection-question');
  if (questionEl && window.CHAPTER_CONFIG?.reflectionPrompt) {
    questionEl.textContent = window.CHAPTER_CONFIG.reflectionPrompt;
  }

  // Load saved reflection
  const savedResponse = localStorage.getItem(`reflection_${currentChapter}`);
  const responseTextarea = document.getElementById('reflection-response');
  if (responseTextarea && savedResponse) {
    responseTextarea.value = savedResponse;
  }

  // Save & Share button
  const saveBtn = document.getElementById('save-reflection');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const text = responseTextarea?.value.trim();
      if (!text) {
        alert("Please write a reflection before saving.");
        return;
      }

      localStorage.setItem(`reflection_${currentChapter}`, text);
      saveReflectionToGroup(currentChapter, text);
      logEvent('reflection_saved', { length: text.length });

      // Transition to quiz
      hideElement('reflection-prompt');
      showElement('quiz-container');
    };
  }

  // View Peer Reflections
  const viewPeersBtn = document.getElementById('view-peer-reflections');
  const peerContainer = document.getElementById('peer-reflections');
  if (viewPeersBtn && peerContainer) {
    viewPeersBtn.onclick = () => {
      const peers = loadPeerReflections(currentChapter);
      peerContainer.innerHTML = peers.length
        ? peers.map(r => `<div class="peer-reflection">${r.text}</div>`).join('')
        : '<em>No peer reflections yet.</em>';
      showElement('peer-reflections');
    };
  }

  // Export My Insights
  const exportBtn = document.getElementById('export-group-data');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const mastery = localStorage.getItem(`mastery_${currentChapter}`) === '1';
      exportMyInsights(currentChapter, mastery);
    };
  }

  // Import Peer Insights Toggle
  const importToggleBtn = document.getElementById('import-peer-data');
  const importArea = document.getElementById('import-area');
  if (importToggleBtn && importArea) {
    importToggleBtn.onclick = () => toggleElement('import-area');
  }

  // Do Import
  const doImportBtn = document.getElementById('do-import');
  const importTextarea = document.getElementById('import-text');
  if (doImportBtn && importTextarea) {
    doImportBtn.onclick = () => {
      const text = importTextarea.value.trim();
      if (text) {
        handlePeerImport(text, currentChapter);
        importTextarea.value = '';
        // Optionally refresh peer view
        if (peerContainer) peerContainer.style.display = 'none';
      }
    };
  }
}
