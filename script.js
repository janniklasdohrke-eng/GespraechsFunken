
<script>
// --- Storage keys ---
const STORAGE_KEYS = {
  TAGS: 'gf_tags',
  SHOWN: 'gf_shown',
};

// --- Storage helpers ---
function saveTags(tags) {
  sessionStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
  sessionStorage.removeItem(STORAGE_KEYS.SHOWN);
}
function loadTags() {
  const raw = sessionStorage.getItem(STORAGE_KEYS.TAGS);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function loadShown() {
  const raw = sessionStorage.getItem(STORAGE_KEYS.SHOWN);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveShown(arr) {
  sessionStorage.setItem(STORAGE_KEYS.SHOWN, JSON.stringify(arr));
}

// --- Fetch questions without fallback ---
async function fetchQuestions() {
  const res = await fetch('questions.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Fehler beim Laden von questions.json (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Die geladene JSON ist kein Array.');
  }
  console.info('questions.json geladen:', data.length, 'Fragen');
  return data;
}

// --- Helpers ---
function getAllTagsFromQuestions(questions) {
  const set = new Set();
  questions.forEach(q => (q.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

function renderTagCheckboxes(allTags, preselectedTags) {
  const tagList = document.getElementById('tagList');
  const badge = document.getElementById('selectedCount');
  if (!tagList) return;

  tagList.innerHTML = '';

  if (!allTags.length) {
    tagList.innerHTML = `<p style="color:#fba130">Keine Tags gefunden. Prüfe <code>questions.json</code>.</p>`;
    if (badge) badge.textContent = '0/0';
    return;
  }

  const selectedSet = new Set(preselectedTags || allTags);

  allTags.forEach(tag => {
    const id = `tag-${tag.replace(/\s+/g, '-').toLowerCase()}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'tag';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.value = tag;
    input.checked = selectedSet.has(tag);

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = tag;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    tagList.appendChild(wrapper);
  });

  updateSelectedCount();
}

function updateSelectedCount() {
  const badge = document.getElementById('selectedCount');
  const checked = document.querySelectorAll('#tagList input[type="checkbox"]:checked').length;
  const total = document.querySelectorAll('#tagList input[type="checkbox"]').length;
  if (badge) {
    badge.textContent = checked === total ? 'Alle' : `${checked}/${total}`;
  }
}

function wireTagSelectionButtons() {
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('#tagList input[type="checkbox"]').forEach(cb => (cb.checked = true));
      updateSelectedCount();
    });
  }
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('#tagList input[type="checkbox"]').forEach(cb => (cb.checked = false));
      updateSelectedCount();
    });
  }

  document.addEventListener('change', (e) => {
    if (e.target && e.target.closest('#tagList')) updateSelectedCount();
  });
}

// --- Index page ---
async function initIndex() {
  try {
    const questions = await fetchQuestions();
    const allTags = getAllTagsFromQuestions(questions);
    const saved = loadTags(); // if user returns
    renderTagCheckboxes(allTags, saved || allTags);
    wireTagSelectionButtons();

    const startBtn = document.getElementById('startBtn');
    startBtn.addEventListener('click', () => {
      const selected = Array.from(document.querySelectorAll('#tagList input[type="checkbox"]:checked')).map(cb => cb.value);
      const tagsToSave = selected.length ? selected : allTags;
      saveTags(tagsToSave);
      window.location.href = 'questions.html';
    });
  } catch (err) {
    console.error('Initialisierung fehlgeschlagen:', err);
    alert('Fehler beim Initialisieren. Bitte prüfe die Konsole und die Datei questions.json.');
  }
}

// --- Questions page ---
function updateProgress(current, total) {
  const el = document.getElementById('progressText');
  if (el) el.textContent = `${current}/${total}`;
}

function renderQuestion(text) {
  const qEl = document.getElementById('question');
  if (qEl) qEl.textContent = text;
}

async function initQuestions() {
  const status = document.getElementById('status');
  const nextBtn = document.getElementById('nextBtn');
  const backBtn = document.getElementById('backBtn');

  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  try {
    const allQuestions = await fetchQuestions();
    const selectedTags = loadTags() || getAllTagsFromQuestions(allQuestions);
    const pool = allQuestions.filter(q => q.tags && q.tags.some(t => selectedTags.includes(t)));

    console.info('Fragen im aktuellen Tag-Pool:', pool.length);

    let shown = loadShown();

    function nextQuestion() {
      const remaining = pool.filter(q => !shown.includes(q.text));
      updateProgress(shown.length, pool.length);

      if (pool.length === 0) {
        renderQuestion('Keine Fragen für die aktuelle Auswahl gefunden.');
        status.textContent = 'Bitte gehe zurück und wähle andere Tags.';
        nextBtn.disabled = true;
        return;
      }

      if (remaining.length === 0) {
        renderQuestion('Alle ausgewählten Fragen wurden angezeigt! 🎉');
        status.textContent = 'Zurück ins Menü, um die Auswahl zu ändern oder die Session neu zu starten.';
        nextBtn.disabled = true;
        return;
      }

      const random = remaining[Math.floor(Math.random() * remaining.length)];
      renderQuestion(random.text);
      shown.push(random.text);
      saveShown(shown);
      updateProgress(shown.length, pool.length);
      status.textContent = '';
      nextBtn.disabled = false;
    }

    // show first question immediately
    nextQuestion();
    nextBtn.addEventListener('click', nextQuestion);
  } catch (err) {
    console.error('Fehler beim Laden der Fragen:', err);
    renderQuestion('Fehler beim Laden der Fragen.');
    if (status) status.textContent = 'Bitte überprüfe die Datei questions.json.';
    if (nextBtn) nextBtn.disabled = true;
  }
}

// --- Router ---
document.addEventListener('DOMContentLoaded', () => {
  // Decide which initializer to run based on presence of elements
  if (document.getElementById('tagList')) {
    initIndex();
  } else if (document.getElementById('question')) {
    initQuestions();
  }
});
</script>
