/* ============================================
   OUR JOURNAL — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ========== APP STATE ==========
  const state = {
    theme: 'light',
    page: 'home',
    location: null, // { lat, lng, city }
    prayerTimes: null,
    nextPrayer: null,
    journal: [],
    adhkarProgress: { morning: {}, evening: {} },
    quranProgress: {
      lastSurah: 67,
      lastAyah: 1,
      bookmarks: [],
      murojaahPercent: 0,
      sessions: 0
    },
    cycle: {
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      notes: ''
    },
    settings: {
      arabicSize: 'md',
      showTranslation: true,
      reduceMotion: false,
      soundEffects: false
    },
    journeyToday: {
      date: null,
      morningAdhkar: false,
      quran: false,
      murojaah: false,
      journal: false,
      quiz: false,
      eveningAdhkar: false
    },
    quizHistory: [],
    murojaahHistory: []
  };

  // ========== LOCAL STORAGE HELPERS ==========
  const STORAGE_KEY = 'ourJournal_v1';

  function saveData(key, value) {
    try {
      const data = loadAll();
      data[key] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed', e);
    }
  }

  function loadData(key, fallback = null) {
    try {
      const data = loadAll();
      return data[key] !== undefined ? data[key] : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function removeData(key) {
    try {
      const data = loadAll();
      delete data[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function hydrateState() {
    state.theme = loadData('theme', 'light');
    state.journal = loadData('journal', []);
    state.adhkarProgress = loadData('adhkarProgress', { morning: {}, evening: {} });
    state.quranProgress = loadData('quranProgress', state.quranProgress);
    state.cycle = loadData('cycle', state.cycle);
    state.settings = loadData('settings', state.settings);
    state.journeyToday = loadData('journeyToday', state.journeyToday);
    state.quizHistory = loadData('quizHistory', []);
    state.murojaahHistory = loadData('murojaahHistory', []);
    state.location = loadData('location', null);

    // Reset journey if new day
    const today = new Date().toDateString();
    if (state.journeyToday.date !== today) {
      state.journeyToday = {
        date: today,
        morningAdhkar: false,
        quran: false,
        murojaah: false,
        journal: false,
        quiz: false,
        eveningAdhkar: false
      };
      saveData('journeyToday', state.journeyToday);
    }
  }

  // ========== THEME ==========
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveData('theme', theme);
    document.querySelectorAll('.theme-pills .pill').forEach(p => {
      p.classList.toggle('active', p.dataset.theme === theme);
    });
  }

  function toggleTheme() {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  }

  // ========== CLOCK & GREETING ==========
  function updateClock() {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const timeStr = now.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const dateStr = now.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Friendly timezone label
    let tzLabel = tz.replace(/_/g, ' ');
    try {
      const offset = -now.getTimezoneOffset() / 60;
      const sign = offset >= 0 ? '+' : '';
      tzLabel += ` · GMT${sign}${offset}`;
    } catch (e) {}

    const clockEl = document.getElementById('liveClock');
    const dateEl = document.getElementById('liveDate');
    const tzEl = document.getElementById('liveTz');
    if (clockEl) clockEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
    if (tzEl) tzEl.textContent = tzLabel;

    // Greeting
    const hour = now.getHours();
    let greeting = '';
    if (hour >= 5 && hour < 11) {
      greeting = 'Good morning.\nTake a breath, begin gently.';
    } else if (hour >= 11 && hour < 15) {
      greeting = 'Good afternoon.\nA little pause in the middle of your day.';
    } else if (hour >= 15 && hour < 18) {
      greeting = 'Good evening.\nSlow down for a moment.';
    } else {
      greeting = 'Good night.\nEnd your day with remembrance.';
    }
    const greetEl = document.getElementById('dynamicGreeting');
    if (greetEl) greetEl.innerHTML = greeting.replace('\n', '<br>');
  }

  // ========== CUSTOM CURSOR ==========
  function initCursor() {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    document.body.classList.add('has-custom-cursor');
    const cursor = document.getElementById('moonCursor');
    const trail = document.getElementById('cursorTrail');
    let trailTimeout;

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      trail.style.left = e.clientX + 'px';
      trail.style.top = e.clientY + 'px';
      trail.style.opacity = '0.5';
      clearTimeout(trailTimeout);
      trailTimeout = setTimeout(() => { trail.style.opacity = '0'; }, 200);
    });

    document.querySelectorAll('a, button, .mood-btn, .tab, .juz-btn, .surah-item, .quiz-opt, .cal-day, .city-item, .radio-card').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
  }

  // ========== NAVIGATION ==========
  function navigateTo(page) {
    state.page = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(page);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === page);
    });

    // Close more menu
    const moreMenu = document.getElementById('moreMenu');
    if (moreMenu) moreMenu.hidden = true;

    window.scrollTo({ top: 0, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });

    // Page-specific init
    if (page === 'journal') renderJournalCalendar();
    if (page === 'adhkar') renderAdhkar('morning');
    if (page === 'quran') initQuranPage();
    if (page === 'quiz') initQuizPage();
    if (page === 'cycle') renderCycle();
    if (page === 'progress') renderProgress();
    if (page === 'home') updateHomeUI();
  }

  // ========== PRAYER TIMES ==========
  // Architecture: isolated service so provider can be swapped
  const PrayerService = {
    async fetchTimes(lat, lng, date = new Date()) {
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=2`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (data.code !== 200) throw new Error('Invalid response');
        const t = data.data.timings;
        return {
          Fajr: t.Fajr,
          Dhuhr: t.Dhuhr,
          Asr: t.Asr,
          Maghrib: t.Maghrib,
          Isha: t.Isha,
          date: data.data.date
        };
      } catch (e) {
        console.warn('Prayer times fetch failed', e);
        return null;
      }
    },

    parseTime(timeStr) {
      // "05:12" or "05:12 (WIB)"
      const clean = timeStr.split(' ')[0];
      const [h, m] = clean.split(':').map(Number);
      return { h, m };
    },

    getNextPrayer(times) {
      if (!times) return null;
      const now = new Date();
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      for (const name of prayers) {
        const { h, m } = this.parseTime(times[name]);
        const prayerDate = new Date(now);
        prayerDate.setHours(h, m, 0, 0);
        if (prayerDate > now) {
          return { name, time: times[name], date: prayerDate };
        }
      }
      // Next is tomorrow's Fajr
      const { h, m } = this.parseTime(times.Fajr);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(h, m, 0, 0);
      return { name: 'Fajr', time: times.Fajr, date: tomorrow };
    },

    formatCountdown(targetDate) {
      const diff = targetDate - new Date();
      if (diff <= 0) return '00:00';
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  };

  async function loadPrayerTimes() {
    const container = document.getElementById('prayerTimes');
    if (!state.location) {
      container.innerHTML = `
        <div class="prayer-fallback">
          <p>Location access is needed for accurate prayer times.</p>
          <button class="btn btn-secondary" id="requestLocationBtn">Use my location</button>
          <button class="btn btn-ghost" id="manualCityBtn">Choose city manually</button>
        </div>`;
      bindPrayerFallbackBtns();
      return;
    }

    container.innerHTML = '<div class="prayer-fallback"><p>Loading prayer times…</p></div>';
    const times = await PrayerService.fetchTimes(state.location.lat, state.location.lng);
    if (!times) {
      container.innerHTML = `
        <div class="prayer-fallback">
          <p>Prayer times couldn't be loaded right now.</p>
          <button class="btn btn-secondary" id="retryPrayerBtn">Retry</button>
          <button class="btn btn-ghost" id="manualCityBtn">Choose city manually</button>
        </div>`;
      document.getElementById('retryPrayerBtn')?.addEventListener('click', loadPrayerTimes);
      document.getElementById('manualCityBtn')?.addEventListener('click', openCityModal);
      return;
    }

    state.prayerTimes = times;
    state.nextPrayer = PrayerService.getNextPrayer(times);
    renderPrayerTimes(times);
    updateNextPrayerUI();
  }

  function renderPrayerTimes(times) {
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const nextName = state.nextPrayer?.name;
    const html = prayers.map(name => `
      <div class="prayer-item ${name === nextName ? 'next' : ''}">
        <div class="prayer-name">${name}</div>
        <div class="prayer-time">${times[name].split(' ')[0]}</div>
      </div>
    `).join('');
    document.getElementById('prayerTimes').innerHTML = html;
  }

  function updateNextPrayerUI() {
    if (!state.nextPrayer) return;
    const nameEl = document.getElementById('nextPrayerName');
    const countEl = document.getElementById('nextPrayerCountdown');
    if (nameEl) nameEl.textContent = state.nextPrayer.name;
    if (countEl) countEl.textContent = PrayerService.formatCountdown(state.nextPrayer.date);
  }

  function bindPrayerFallbackBtns() {
    document.getElementById('requestLocationBtn')?.addEventListener('click', requestGeolocation);
    document.getElementById('manualCityBtn')?.addEventListener('click', openCityModal);
  }

  function requestGeolocation() {
    if (!navigator.geolocation) {
      openCityModal();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city: 'Your location'
        };
        saveData('location', state.location);
        loadPrayerTimes();
      },
      () => {
        openCityModal();
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  function openCityModal() {
    document.getElementById('cityModal').hidden = false;
  }

  function closeCityModal() {
    document.getElementById('cityModal').hidden = true;
  }

  // ========== JOURNAL ==========
  const JOURNAL_PROMPTS = [
    'What is one thing you want to remember today?',
    'Where did you feel Allah\'s presence today?',
    'What are you carrying that you can release?',
    'Write a short letter of gratitude.',
    'What slowed you down in a good way today?',
    'Take a quiet moment to write.'
  ];

  function setJournalPrompt() {
    const el = document.getElementById('journalPrompt');
    if (el) el.textContent = JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  }

  function saveJournalEntry(text, mood, gratitude) {
    if (!text.trim()) return;
    const entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      text: text.trim(),
      mood: mood || null,
      gratitude: gratitude.filter(g => g.trim())
    };
    state.journal.unshift(entry);
    saveData('journal', state.journal);
    markJourney('journal');
    renderJournalHistory();
    renderJournalCalendar();
  }

  function renderJournalHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;
    if (state.journal.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No entries yet.</p>';
      return;
    }
    list.innerHTML = state.journal.slice(0, 10).map(e => {
      const d = new Date(e.date);
      const preview = e.text.slice(0, 60) + (e.text.length > 60 ? '…' : '');
      return `
        <div class="history-item" data-id="${e.id}">
          <div class="history-date">${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <div class="history-preview">${preview}</div>
        </div>`;
    }).join('');
    list.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => showEntry(item.dataset.id));
    });
  }

  function showEntry(id) {
    const entry = state.journal.find(e => e.id === id);
    if (!entry) return;
    const detail = document.getElementById('entryDetail');
    const content = document.getElementById('entryContent');
    const d = new Date(entry.date);
    content.innerHTML = `
      <div class="entry-date">${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      ${entry.mood ? `<span class="entry-mood">${entry.mood}</span>` : ''}
      <div class="entry-body">${escapeHtml(entry.text)}</div>
      ${entry.gratitude?.length ? `<div class="entry-gratitude"><strong>Grateful for:</strong><br>${entry.gratitude.map(g => '· ' + escapeHtml(g)).join('<br>')}</div>` : ''}
    `;
    detail.hidden = false;
    document.querySelector('.journal-layout').style.display = 'none';
  }

  function closeEntry() {
    document.getElementById('entryDetail').hidden = true;
    document.querySelector('.journal-layout').style.display = '';
  }

  function renderJournalCalendar() {
    const widget = document.getElementById('journalCalendar');
    if (!widget) return;
    const now = new Date();
    const year = widget.dataset.year ? +widget.dataset.year : now.getFullYear();
    const month = widget.dataset.month !== undefined ? +widget.dataset.month : now.getMonth();

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();
    const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const entryDates = new Set(state.journal.map(e => new Date(e.date).toDateString()));

    let daysHtml = '';
    // prev month padding
    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      daysHtml += `<div class="cal-day other-month">${prevLast - i}</div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = date.toDateString() === now.toDateString();
      const hasEntry = entryDates.has(date.toDateString());
      daysHtml += `<div class="cal-day ${isToday ? 'today' : ''} ${hasEntry ? 'has-entry' : ''}" data-date="${date.toISOString()}">${d}</div>`;
    }

    widget.innerHTML = `
      <div class="cal-header">
        <span>${monthName}</span>
        <div class="cal-nav">
          <button data-dir="-1" aria-label="Previous month">‹</button>
          <button data-dir="1" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="cal-grid">
        <div class="cal-day-name">Su</div><div class="cal-day-name">Mo</div><div class="cal-day-name">Tu</div>
        <div class="cal-day-name">We</div><div class="cal-day-name">Th</div><div class="cal-day-name">Fr</div>
        <div class="cal-day-name">Sa</div>
        ${daysHtml}
      </div>`;

    widget.dataset.year = year;
    widget.dataset.month = month;

    widget.querySelectorAll('.cal-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        let m = +widget.dataset.month + +btn.dataset.dir;
        let y = +widget.dataset.year;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        widget.dataset.month = m;
        widget.dataset.year = y;
        renderJournalCalendar();
      });
    });

    widget.querySelectorAll('.cal-day.has-entry').forEach(day => {
      day.addEventListener('click', () => {
        const dateStr = new Date(day.dataset.date).toDateString();
        const entry = state.journal.find(e => new Date(e.date).toDateString() === dateStr);
        if (entry) showEntry(entry.id);
      });
    });
  }

  // ========== ADHKAR ==========
  const ADHKAR_DATA = {
    morning: [
      { id: 'm1', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ', title: 'We have entered the morning and the dominion belongs to Allah', count: 1 },
      { id: 'm2', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا', title: 'O Allah, by You we enter the morning', count: 1 },
      { id: 'm3', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', title: 'Glory is to Allah and praise is to Him', count: 100 },
      { id: 'm4', arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', title: 'I seek forgiveness of Allah and repent to Him', count: 100 },
      { id: 'm5', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', title: 'There is none worthy of worship but Allah alone', count: 10 },
      { id: 'm6', arabic: 'سُبْحَانَ اللَّهِ', title: 'Glory be to Allah', count: 33 },
      { id: 'm7', arabic: 'الْحَمْدُ لِلَّهِ', title: 'All praise is for Allah', count: 33 },
      { id: 'm8', arabic: 'اللَّهُ أَكْبَرُ', title: 'Allah is the Greatest', count: 34 }
    ],
    evening: [
      { id: 'e1', arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ', title: 'We have entered the evening and the dominion belongs to Allah', count: 1 },
      { id: 'e2', arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا', title: 'O Allah, by You we enter the evening', count: 1 },
      { id: 'e3', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', title: 'Glory is to Allah and praise is to Him', count: 100 },
      { id: 'e4', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ', title: 'I seek refuge in the perfect words of Allah', count: 3 },
      { id: 'e5', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ', title: 'In the name of Allah with whose name nothing can harm', count: 3 },
      { id: 'e6', arabic: 'سُبْحَانَ اللَّهِ', title: 'Glory be to Allah', count: 33 },
      { id: 'e7', arabic: 'الْحَمْدُ لِلَّهِ', title: 'All praise is for Allah', count: 33 },
      { id: 'e8', arabic: 'اللَّهُ أَكْبَرُ', title: 'Allah is the Greatest', count: 34 }
    ]
  };

  let currentAdhkarTab = 'morning';
  let focusIndex = 0;

  function renderAdhkar(tab) {
    currentAdhkarTab = tab;
    const list = ADHKAR_DATA[tab];
    const progress = state.adhkarProgress[tab] || {};
    const container = document.getElementById('adhkarList');
    const desc = document.getElementById('adhkarDesc');
    if (desc) desc.textContent = tab === 'morning' ? 'Begin with remembrance.' : 'Slow down. End your day with remembrance.';

    let completed = 0;
    container.innerHTML = list.map((item, idx) => {
      const current = progress[item.id] || 0;
      const done = current >= item.count;
      if (done) completed++;
      return `
        <div class="adhkar-item ${done ? 'completed' : ''}" data-id="${item.id}" data-idx="${idx}">
          <p class="adhkar-arabic" dir="rtl">${item.arabic}</p>
          <p class="adhkar-title">${item.title}</p>
          <div class="adhkar-counter-row">
            <span class="adhkar-count">${current} / ${item.count}</span>
            <button class="count-btn" data-action="dec" data-id="${item.id}" ${current <= 0 ? 'disabled' : ''}>−</button>
            <button class="count-btn" data-action="inc" data-id="${item.id}" ${done ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
    }).join('');

    updateAdhkarProgressUI(completed, list.length);

    container.querySelectorAll('.count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const item = list.find(i => i.id === id);
        if (!item) return;
        let val = state.adhkarProgress[tab][id] || 0;
        if (action === 'inc' && val < item.count) val++;
        if (action === 'dec' && val > 0) val--;
        state.adhkarProgress[tab][id] = val;
        saveData('adhkarProgress', state.adhkarProgress);
        if (val >= item.count) {
          if (tab === 'morning') markJourney('morningAdhkar');
          if (tab === 'evening') markJourney('eveningAdhkar');
        }
        renderAdhkar(tab);
      });
    });
  }

  function updateAdhkarProgressUI(done, total) {
    const text = document.getElementById('adhkarProgressText');
    const fill = document.getElementById('adhkarProgressFill');
    if (text) text.textContent = `${done} / ${total} completed`;
    if (fill) fill.style.width = total ? `${(done / total) * 100}%` : '0%';
  }

  // Focus Mode
  function enterFocusMode() {
    const list = ADHKAR_DATA[currentAdhkarTab];
    // Find first incomplete
    focusIndex = list.findIndex(item => {
      const c = state.adhkarProgress[currentAdhkarTab][item.id] || 0;
      return c < item.count;
    });
    if (focusIndex < 0) focusIndex = 0;
    showFocusItem();
    document.getElementById('focusOverlay').hidden = false;
  }

  function showFocusItem() {
    const list = ADHKAR_DATA[currentAdhkarTab];
    const item = list[focusIndex];
    if (!item) return;
    const current = state.adhkarProgress[currentAdhkarTab][item.id] || 0;
    document.getElementById('focusArabic').textContent = item.arabic;
    document.getElementById('focusTitle').textContent = item.title;
    document.getElementById('focusCount').textContent = current;
    document.getElementById('focusTarget').textContent = item.count;
    document.getElementById('focusComplete').hidden = current < item.count;
    document.getElementById('focusTap').style.display = current >= item.count ? 'none' : 'inline-flex';
  }

  function focusTap() {
    const list = ADHKAR_DATA[currentAdhkarTab];
    const item = list[focusIndex];
    if (!item) return;
    let val = state.adhkarProgress[currentAdhkarTab][item.id] || 0;
    if (val < item.count) {
      val++;
      state.adhkarProgress[currentAdhkarTab][item.id] = val;
      saveData('adhkarProgress', state.adhkarProgress);
      document.getElementById('focusCount').textContent = val;
      if (val >= item.count) {
        document.getElementById('focusComplete').hidden = false;
        document.getElementById('focusTap').style.display = 'none';
        if (currentAdhkarTab === 'morning') markJourney('morningAdhkar');
        if (currentAdhkarTab === 'evening') markJourney('eveningAdhkar');
        // Auto advance after short delay
        setTimeout(() => {
          const next = list.findIndex((it, i) => {
            if (i <= focusIndex) return false;
            const c = state.adhkarProgress[currentAdhkarTab][it.id] || 0;
            return c < it.count;
          });
          if (next >= 0) {
            focusIndex = next;
            showFocusItem();
          }
        }, 1200);
      }
    }
  }

  // ========== QUR'AN ==========
  // Clean architecture for Qur'an data
  const QuranService = {
    // Surah metadata (verified, minimal)
    surahs: [
      { n: 1, en: 'Al-Fatihah', ar: 'الفاتحة', ayahs: 7, meaning: 'The Opening' },
      { n: 2, en: 'Al-Baqarah', ar: 'البقرة', ayahs: 286, meaning: 'The Cow' },
      { n: 3, en: 'Ali \'Imran', ar: 'آل عمران', ayahs: 200, meaning: 'Family of Imran' },
      { n: 4, en: 'An-Nisa', ar: 'النساء', ayahs: 176, meaning: 'The Women' },
      { n: 5, en: 'Al-Ma\'idah', ar: 'المائدة', ayahs: 120, meaning: 'The Table' },
      { n: 6, en: 'Al-An\'am', ar: 'الأنعام', ayahs: 165, meaning: 'The Cattle' },
      { n: 7, en: 'Al-A\'raf', ar: 'الأعراف', ayahs: 206, meaning: 'The Heights' },
      { n: 8, en: 'Al-Anfal', ar: 'الأنفال', ayahs: 75, meaning: 'The Spoils' },
      { n: 9, en: 'At-Tawbah', ar: 'التوبة', ayahs: 129, meaning: 'The Repentance' },
      { n: 10, en: 'Yunus', ar: 'يونس', ayahs: 109, meaning: 'Jonah' },
      { n: 11, en: 'Hud', ar: 'هود', ayahs: 123, meaning: 'Hud' },
      { n: 12, en: 'Yusuf', ar: 'يوسف', ayahs: 111, meaning: 'Joseph' },
      { n: 13, en: 'Ar-Ra\'d', ar: 'الرعد', ayahs: 43, meaning: 'The Thunder' },
      { n: 14, en: 'Ibrahim', ar: 'إبراهيم', ayahs: 52, meaning: 'Abraham' },
      { n: 15, en: 'Al-Hijr', ar: 'الحجر', ayahs: 99, meaning: 'The Rocky Tract' },
      { n: 16, en: 'An-Nahl', ar: 'النحل', ayahs: 128, meaning: 'The Bee' },
      { n: 17, en: 'Al-Isra', ar: 'الإسراء', ayahs: 111, meaning: 'The Night Journey' },
      { n: 18, en: 'Al-Kahf', ar: 'الكهف', ayahs: 110, meaning: 'The Cave' },
      { n: 19, en: 'Maryam', ar: 'مريم', ayahs: 98, meaning: 'Mary' },
      { n: 20, en: 'Taha', ar: 'طه', ayahs: 135, meaning: 'Ta-Ha' },
      { n: 21, en: 'Al-Anbiya', ar: 'الأنبياء', ayahs: 112, meaning: 'The Prophets' },
      { n: 22, en: 'Al-Hajj', ar: 'الحج', ayahs: 78, meaning: 'The Pilgrimage' },
      { n: 23, en: 'Al-Mu\'minun', ar: 'المؤمنون', ayahs: 118, meaning: 'The Believers' },
      { n: 24, en: 'An-Nur', ar: 'النور', ayahs: 64, meaning: 'The Light' },
      { n: 25, en: 'Al-Furqan', ar: 'الفرقان', ayahs: 77, meaning: 'The Criterion' },
      { n: 26, en: 'Ash-Shu\'ara', ar: 'الشعراء', ayahs: 227, meaning: 'The Poets' },
      { n: 27, en: 'An-Naml', ar: 'النمل', ayahs: 93, meaning: 'The Ant' },
      { n: 28, en: 'Al-Qasas', ar: 'القصص', ayahs: 88, meaning: 'The Stories' },
      { n: 29, en: 'Al-\'Ankabut', ar: 'العنكبوت', ayahs: 69, meaning: 'The Spider' },
      { n: 30, en: 'Ar-Rum', ar: 'الروم', ayahs: 60, meaning: 'The Romans' },
      { n: 31, en: 'Luqman', ar: 'لقمان', ayahs: 34, meaning: 'Luqman' },
      { n: 32, en: 'As-Sajdah', ar: 'السجدة', ayahs: 30, meaning: 'The Prostration' },
      { n: 33, en: 'Al-Ahzab', ar: 'الأحزاب', ayahs: 73, meaning: 'The Combined Forces' },
      { n: 34, en: 'Saba', ar: 'سبإ', ayahs: 54, meaning: 'Sheba' },
      { n: 35, en: 'Fatir', ar: 'فاطر', ayahs: 45, meaning: 'The Originator' },
      { n: 36, en: 'Ya-Sin', ar: 'يس', ayahs: 83, meaning: 'Ya Sin' },
      { n: 37, en: 'As-Saffat', ar: 'الصافات', ayahs: 182, meaning: 'Those who set the Ranks' },
      { n: 38, en: 'Sad', ar: 'ص', ayahs: 88, meaning: 'The Letter Sad' },
      { n: 39, en: 'Az-Zumar', ar: 'الزمر', ayahs: 75, meaning: 'The Troops' },
      { n: 40, en: 'Ghafir', ar: 'غافر', ayahs: 85, meaning: 'The Forgiver' },
      { n: 41, en: 'Fussilat', ar: 'فصلت', ayahs: 54, meaning: 'Explained in Detail' },
      { n: 42, en: 'Ash-Shura', ar: 'الشورى', ayahs: 53, meaning: 'The Consultation' },
      { n: 43, en: 'Az-Zukhruf', ar: 'الزخرف', ayahs: 89, meaning: 'The Ornaments' },
      { n: 44, en: 'Ad-Dukhan', ar: 'الدخان', ayahs: 59, meaning: 'The Smoke' },
      { n: 45, en: 'Al-Jathiyah', ar: 'الجاثية', ayahs: 37, meaning: 'The Crouching' },
      { n: 46, en: 'Al-Ahqaf', ar: 'الأحقاف', ayahs: 35, meaning: 'The Wind-Curved Sandhills' },
      { n: 47, en: 'Muhammad', ar: 'محمد', ayahs: 38, meaning: 'Muhammad' },
      { n: 48, en: 'Al-Fath', ar: 'الفتح', ayahs: 29, meaning: 'The Victory' },
      { n: 49, en: 'Al-Hujurat', ar: 'الحجرات', ayahs: 18, meaning: 'The Rooms' },
      { n: 50, en: 'Qaf', ar: 'ق', ayahs: 45, meaning: 'The Letter Qaf' },
      { n: 51, en: 'Adh-Dhariyat', ar: 'الذاريات', ayahs: 60, meaning: 'The Winnowing Winds' },
      { n: 52, en: 'At-Tur', ar: 'الطور', ayahs: 49, meaning: 'The Mount' },
      { n: 53, en: 'An-Najm', ar: 'النجم', ayahs: 62, meaning: 'The Star' },
      { n: 54, en: 'Al-Qamar', ar: 'القمر', ayahs: 55, meaning: 'The Moon' },
      { n: 55, en: 'Ar-Rahman', ar: 'الرحمن', ayahs: 78, meaning: 'The Beneficent' },
      { n: 56, en: 'Al-Waqi\'ah', ar: 'الواقعة', ayahs: 96, meaning: 'The Inevitable' },
      { n: 57, en: 'Al-Hadid', ar: 'الحديد', ayahs: 29, meaning: 'The Iron' },
      { n: 58, en: 'Al-Mujadila', ar: 'المجادلة', ayahs: 22, meaning: 'The Pleading Woman' },
      { n: 59, en: 'Al-Hashr', ar: 'الحشر', ayahs: 24, meaning: 'The Exile' },
      { n: 60, en: 'Al-Mumtahanah', ar: 'الممتحنة', ayahs: 13, meaning: 'She that is to be examined' },
      { n: 61, en: 'As-Saff', ar: 'الصف', ayahs: 14, meaning: 'The Ranks' },
      { n: 62, en: 'Al-Jumu\'ah', ar: 'الجمعة', ayahs: 11, meaning: 'The Congregation' },
      { n: 63, en: 'Al-Munafiqun', ar: 'المنافقون', ayahs: 11, meaning: 'The Hypocrites' },
      { n: 64, en: 'At-Taghabun', ar: 'التغابن', ayahs: 18, meaning: 'The Mutual Disillusion' },
      { n: 65, en: 'At-Talaq', ar: 'الطلاق', ayahs: 12, meaning: 'The Divorce' },
      { n: 66, en: 'At-Tahrim', ar: 'التحريم', ayahs: 12, meaning: 'The Prohibition' },
      { n: 67, en: 'Al-Mulk', ar: 'الملك', ayahs: 30, meaning: 'The Sovereignty' },
      { n: 68, en: 'Al-Qalam', ar: 'القلم', ayahs: 52, meaning: 'The Pen' },
      { n: 69, en: 'Al-Haqqah', ar: 'الحاقة', ayahs: 52, meaning: 'The Reality' },
      { n: 70, en: 'Al-Ma\'arij', ar: 'المعارج', ayahs: 44, meaning: 'The Ascending Stairways' },
      { n: 71, en: 'Nuh', ar: 'نوح', ayahs: 28, meaning: 'Noah' },
      { n: 72, en: 'Al-Jinn', ar: 'الجن', ayahs: 28, meaning: 'The Jinn' },
      { n: 73, en: 'Al-Muzzammil', ar: 'المزمل', ayahs: 20, meaning: 'The Enshrouded One' },
      { n: 74, en: 'Al-Muddaththir', ar: 'المدثر', ayahs: 56, meaning: 'The Cloaked One' },
      { n: 75, en: 'Al-Qiyamah', ar: 'القيامة', ayahs: 40, meaning: 'The Resurrection' },
      { n: 76, en: 'Al-Insan', ar: 'الانسان', ayahs: 31, meaning: 'The Man' },
      { n: 77, en: 'Al-Mursalat', ar: 'المرسلات', ayahs: 50, meaning: 'The Emissaries' },
      { n: 78, en: 'An-Naba', ar: 'النبإ', ayahs: 40, meaning: 'The Tidings' },
      { n: 79, en: 'An-Nazi\'at', ar: 'النازعات', ayahs: 46, meaning: 'Those who drag forth' },
      { n: 80, en: '\'Abasa', ar: 'عبس', ayahs: 42, meaning: 'He Frowned' },
      { n: 81, en: 'At-Takwir', ar: 'التكوير', ayahs: 29, meaning: 'The Overthrowing' },
      { n: 82, en: 'Al-Infitar', ar: 'الإنفطار', ayahs: 19, meaning: 'The Cleaving' },
      { n: 83, en: 'Al-Mutaffifin', ar: 'المطففين', ayahs: 36, meaning: 'The Defrauding' },
      { n: 84, en: 'Al-Inshiqaq', ar: 'الإنشقاق', ayahs: 25, meaning: 'The Sundering' },
      { n: 85, en: 'Al-Buruj', ar: 'البروج', ayahs: 22, meaning: 'The Mansions of the Stars' },
      { n: 86, en: 'At-Tariq', ar: 'الطارق', ayahs: 17, meaning: 'The Nightcomer' },
      { n: 87, en: 'Al-A\'la', ar: 'الأعلى', ayahs: 19, meaning: 'The Most High' },
      { n: 88, en: 'Al-Ghashiyah', ar: 'الغاشية', ayahs: 26, meaning: 'The Overwhelming' },
      { n: 89, en: 'Al-Fajr', ar: 'الفجر', ayahs: 30, meaning: 'The Dawn' },
      { n: 90, en: 'Al-Balad', ar: 'البلد', ayahs: 20, meaning: 'The City' },
      { n: 91, en: 'Ash-Shams', ar: 'الشمس', ayahs: 15, meaning: 'The Sun' },
      { n: 92, en: 'Al-Layl', ar: 'الليل', ayahs: 21, meaning: 'The Night' },
      { n: 93, en: 'Ad-Duha', ar: 'الضحى', ayahs: 11, meaning: 'The Morning Hours' },
      { n: 94, en: 'Ash-Sharh', ar: 'الشرح', ayahs: 8, meaning: 'The Relief' },
      { n: 95, en: 'At-Tin', ar: 'التين', ayahs: 8, meaning: 'The Fig' },
      { n: 96, en: 'Al-\'Alaq', ar: 'العلق', ayahs: 19, meaning: 'The Clot' },
      { n: 97, en: 'Al-Qadr', ar: 'القدر', ayahs: 5, meaning: 'The Power' },
      { n: 98, en: 'Al-Bayyinah', ar: 'البينة', ayahs: 8, meaning: 'The Clear Proof' },
      { n: 99, en: 'Az-Zalzalah', ar: 'الزلزلة', ayahs: 8, meaning: 'The Earthquake' },
      { n: 100, en: 'Al-\'Adiyat', ar: 'العاديات', ayahs: 11, meaning: 'The Courser' },
      { n: 101, en: 'Al-Qari\'ah', ar: 'القارعة', ayahs: 11, meaning: 'The Calamity' },
      { n: 102, en: 'At-Takathur', ar: 'التكاثر', ayahs: 8, meaning: 'The Rivalry in world increase' },
      { n: 103, en: 'Al-\'Asr', ar: 'العصر', ayahs: 3, meaning: 'The Declining Day' },
      { n: 104, en: 'Al-Humazah', ar: 'الهمزة', ayahs: 9, meaning: 'The Traducer' },
      { n: 105, en: 'Al-Fil', ar: 'الفيل', ayahs: 5, meaning: 'The Elephant' },
      { n: 106, en: 'Quraysh', ar: 'قريش', ayahs: 4, meaning: 'Quraysh' },
      { n: 107, en: 'Al-Ma\'un', ar: 'الماعون', ayahs: 7, meaning: 'The Small Kindnesses' },
      { n: 108, en: 'Al-Kawthar', ar: 'الكوثر', ayahs: 3, meaning: 'The Abundance' },
      { n: 109, en: 'Al-Kafirun', ar: 'الكافرون', ayahs: 6, meaning: 'The Disbelievers' },
      { n: 110, en: 'An-Nasr', ar: 'النصر', ayahs: 3, meaning: 'The Divine Support' },
      { n: 111, en: 'Al-Masad', ar: 'المسد', ayahs: 5, meaning: 'The Palm Fiber' },
      { n: 112, en: 'Al-Ikhlas', ar: 'الإخلاص', ayahs: 4, meaning: 'The Sincerity' },
      { n: 113, en: 'Al-Falaq', ar: 'الفلق', ayahs: 5, meaning: 'The Daybreak' },
      { n: 114, en: 'An-Nas', ar: 'الناس', ayahs: 6, meaning: 'Mankind' }
    ],

    async fetchSurah(number) {
      // Using Al-Quran Cloud API (verified source)
      try {
        const [arRes, enRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${number}`),
          fetch(`https://api.alquran.cloud/v1/surah/${number}/en.sahih`)
        ]);
        if (!arRes.ok) throw new Error('Arabic fetch failed');
        const arData = await arRes.json();
        let enAyahs = [];
        if (enRes.ok) {
          const enData = await enRes.json();
          enAyahs = enData.data?.ayahs || [];
        }
        return {
          number: arData.data.number,
          name: arData.data.name,
          englishName: arData.data.englishName,
          englishNameTranslation: arData.data.englishNameTranslation,
          ayahs: arData.data.ayahs.map((a, i) => ({
            number: a.numberInSurah,
            arabic: a.text,
            translation: enAyahs[i]?.text || ''
          }))
        };
      } catch (e) {
        console.warn('Qur\'an API error', e);
        return null;
      }
    }
  };

  let currentSurahData = null;
  let showTrans = true;

  function initQuranPage() {
    // Juz grid
    const juzGrid = document.getElementById('juzGrid');
    if (juzGrid && !juzGrid.children.length) {
      juzGrid.innerHTML = Array.from({ length: 30 }, (_, i) =>
        `<button class="juz-btn" data-juz="${i + 1}">Juz ${i + 1}</button>`
      ).join('');
      juzGrid.querySelectorAll('.juz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Open first surah of approximate juz (simplified)
          const juzMap = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8,
            11: 9, 12: 11, 13: 12, 14: 15, 15: 17, 16: 18, 17: 21, 18: 23, 19: 25, 20: 27,
            21: 29, 22: 33, 23: 36, 24: 39, 25: 41, 26: 46, 27: 51, 28: 58, 29: 67, 30: 78 };
          openReader(juzMap[+btn.dataset.juz] || 1);
        });
      });
    }

    // Surah list
    renderSurahList();

    // Continue card
    const s = QuranService.surahs.find(x => x.n === state.quranProgress.lastSurah) || QuranService.surahs[66];
    document.getElementById('readerContinueTitle').textContent = s.en;
    document.getElementById('continueSurah').textContent = s.en;
    document.getElementById('continueAyat').textContent = `Ayat ${state.quranProgress.lastAyah}`;

    // Murojaah selects
    const juzSel = document.getElementById('muroJuzSelect');
    if (juzSel && !juzSel.children.length) {
      juzSel.innerHTML = Array.from({ length: 30 }, (_, i) =>
        `<option value="${i + 1}">Juz ${i + 1}</option>`
      ).join('');
    }
    const surahSel = document.getElementById('muroSurahSelect');
    if (surahSel && !surahSel.children.length) {
      surahSel.innerHTML = QuranService.surahs.map(s =>
        `<option value="${s.n}">${s.n}. ${s.en}</option>`
      ).join('');
    }

    // Progress tab
    renderQuranProgress();
  }

  function renderSurahList(filter = '') {
    const list = document.getElementById('surahList');
    if (!list) return;
    const filtered = QuranService.surahs.filter(s =>
      s.en.toLowerCase().includes(filter.toLowerCase()) ||
      s.ar.includes(filter) ||
      String(s.n).includes(filter)
    );
    list.innerHTML = filtered.map(s => `
      <div class="surah-item" data-num="${s.n}">
        <span class="surah-num">${s.n}</span>
        <div class="surah-names">
          <div class="surah-en">${s.en}</div>
          <div class="surah-ar">${s.ar}</div>
        </div>
        <span class="surah-ayahs">${s.ayahs} ayahs</span>
      </div>
    `).join('');
    list.querySelectorAll('.surah-item').forEach(item => {
      item.addEventListener('click', () => openReader(+item.dataset.num));
    });
  }

  async function openReader(surahNum) {
    const reader = document.getElementById('quranReader');
    const panels = document.querySelectorAll('.quran-panel');
    panels.forEach(p => { p.hidden = true; p.classList.remove('active'); });
    reader.hidden = false;

    const body = document.getElementById('readerBody');
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Loading…</p>';

    const data = await QuranService.fetchSurah(surahNum);
    if (!data) {
      body.innerHTML = `
        <div style="text-align:center;padding:2rem;">
          <p>Could not load this surah right now.</p>
          <p style="color:var(--text-muted);font-size:0.9rem;margin-top:0.5rem;">Check your connection and try again.</p>
          <button class="btn btn-secondary" id="retrySurah" style="margin-top:1rem;">Retry</button>
        </div>`;
      document.getElementById('retrySurah')?.addEventListener('click', () => openReader(surahNum));
      return;
    }

    currentSurahData = data;
    state.quranProgress.lastSurah = surahNum;
    state.quranProgress.lastAyah = 1;
    saveData('quranProgress', state.quranProgress);
    markJourney('quran');

    document.getElementById('readerSurahNum').textContent = data.number;
    document.getElementById('readerSurahName').textContent = data.englishName;
    document.getElementById('readerSurahEn').textContent = data.englishNameTranslation;

    const sizeMap = { sm: '1.25rem', md: '1.55rem', lg: '1.9rem' };
    document.documentElement.style.setProperty('--arabic-size', sizeMap[state.settings.arabicSize] || '1.55rem');

    body.innerHTML = data.ayahs.map(a => `
      <div class="ayah" id="ayah-${a.number}">
        <span class="ayah-num">${a.number}</span>
        <p class="ayah-arabic" dir="rtl">${a.arabic}</p>
        <p class="ayah-trans ${showTrans ? '' : 'hidden'}">${a.translation}</p>
      </div>
    `).join('');

    // Nav
    document.getElementById('prevSurah').onclick = () => {
      if (surahNum > 1) openReader(surahNum - 1);
    };
    document.getElementById('nextSurah').onclick = () => {
      if (surahNum < 114) openReader(surahNum + 1);
    };
  }

  function closeReader() {
    document.getElementById('quranReader').hidden = true;
    document.getElementById('quranRead').hidden = false;
    document.getElementById('quranRead').classList.add('active');
  }

  function renderQuranProgress() {
    const cards = document.getElementById('quranProgressCards');
    if (!cards) return;
    const s = QuranService.surahs.find(x => x.n === state.quranProgress.lastSurah);
    cards.innerHTML = `
      <div class="progress-card">
        <h3>Continue Reading</h3>
        <div class="progress-stat"><span>${s?.en || '—'}</span><span class="val">Ayah ${state.quranProgress.lastAyah}</span></div>
      </div>
      <div class="progress-card">
        <h3>Murojaah</h3>
        <div class="progress-stat"><span>Sessions this week</span><span class="val">${state.quranProgress.sessions || 0}</span></div>
        <div class="progress-stat"><span>Progress</span><span class="val">${state.quranProgress.murojaahPercent || 0}%</span></div>
      </div>
      <div class="progress-card">
        <h3>Bookmarks</h3>
        <div class="progress-stat"><span>Saved</span><span class="val">${state.quranProgress.bookmarks?.length || 0}</span></div>
      </div>
    `;
  }

  // ========== MUROJAAH ==========
  let muroSession = null;

  async function startMurojaah() {
    const type = document.querySelector('input[name="muroType"]:checked')?.value || 'juz';
    const mode = document.querySelector('input[name="muroMode"]:checked')?.value || 'guided';
    let surahNum, from, to;

    if (type === 'juz') {
      const juz = +document.getElementById('muroJuzSelect').value;
      // Simplified: use a representative surah for the juz
      const juzMap = { 30: 67, 29: 67, 1: 1 };
      surahNum = juzMap[juz] || 67;
      from = 1;
      to = 10;
    } else {
      surahNum = +document.getElementById('muroSurahSelect').value;
      from = +document.getElementById('muroFrom').value || 1;
      to = +document.getElementById('muroTo').value || 5;
    }

    const data = await QuranService.fetchSurah(surahNum);
    if (!data) {
      alert('Could not load ayahs. Please check your connection.');
      return;
    }

    const ayahs = data.ayahs.filter(a => a.number >= from && a.number <= to);
    if (!ayahs.length) {
      alert('Invalid ayah range.');
      return;
    }

    muroSession = {
      surah: data.englishName,
      surahNum,
      ayahs,
      index: 0,
      mode,
      matched: 0,
      review: 0,
      startTime: Date.now()
    };

    document.getElementById('murojaahSetup').hidden = true;
    document.getElementById('murojaahSession').hidden = false;
    document.getElementById('murojaahResult').hidden = true;
    showMuroAyah();
  }

  function showMuroAyah() {
    if (!muroSession) return;
    const a = muroSession.ayahs[muroSession.index];
    document.getElementById('muroTitle').textContent =
      `${muroSession.surah} · ${muroSession.ayahs[0].number}–${muroSession.ayahs[muroSession.ayahs.length - 1].number}`;
    const ayahEl = document.getElementById('muroAyah');
    ayahEl.textContent = a.arabic;
    ayahEl.classList.toggle('hidden-mode', muroSession.mode === 'memory');
    document.getElementById('muroFeedback').hidden = true;
    document.getElementById('muroStatus').textContent = '● Ready';
    const pct = ((muroSession.index) / muroSession.ayahs.length) * 100;
    document.getElementById('muroSessionProgress').style.width = pct + '%';
  }

  function startRecitation() {
    if (!muroSession) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      document.getElementById('muroFeedback').hidden = false;
      document.getElementById('muroFeedback').className = 'muro-feedback review';
      document.getElementById('muroFeedback').textContent =
        'Recitation checking isn\'t available in this browser yet.';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    document.getElementById('muroStatus').textContent = '● Listening…';
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const expected = muroSession.ayahs[muroSession.index].arabic;
      // Simple comparison (normalized)
      const norm = (s) => s.replace(/[^\u0600-\u06FF\s]/g, '').replace(/\s+/g, ' ').trim();
      const tNorm = norm(transcript);
      const eNorm = norm(expected);
      // Rough similarity
      const similar = tNorm.length > 5 && (
        eNorm.includes(tNorm.slice(0, Math.min(20, tNorm.length))) ||
        tNorm.includes(eNorm.slice(0, Math.min(15, eNorm.length)))
      );

      const feedback = document.getElementById('muroFeedback');
      feedback.hidden = false;
      if (similar) {
        feedback.className = 'muro-feedback matched';
        feedback.textContent = 'Matched';
        muroSession.matched++;
      } else {
        feedback.className = 'muro-feedback review';
        feedback.textContent = 'Something may not match the verse. Needs Review.';
        muroSession.review++;
      }
      document.getElementById('muroStatus').textContent = '● Done';
    };

    recognition.onerror = (e) => {
      document.getElementById('muroStatus').textContent = '● Ready';
      const feedback = document.getElementById('muroFeedback');
      feedback.hidden = false;
      feedback.className = 'muro-feedback review';
      if (e.error === 'not-allowed') {
        feedback.textContent = 'Microphone access is required for recitation checking.';
      } else {
        feedback.textContent = 'Could not capture audio. Try again.';
      }
    };
  }

  function nextMuroAyah() {
    if (!muroSession) return;
    muroSession.index++;
    if (muroSession.index >= muroSession.ayahs.length) {
      finishMurojaah();
    } else {
      showMuroAyah();
    }
  }

  function finishMurojaah() {
    const elapsed = Math.round((Date.now() - muroSession.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    document.getElementById('murojaahSession').hidden = true;
    document.getElementById('murojaahResult').hidden = false;
    document.getElementById('muroTotalAyat').textContent = muroSession.ayahs.length;
    document.getElementById('muroMatched').textContent = muroSession.matched;
    document.getElementById('muroReview').textContent = muroSession.review;
    document.getElementById('muroTime').textContent = `Time: ${mins}m ${secs}s`;

    state.quranProgress.sessions = (state.quranProgress.sessions || 0) + 1;
    state.quranProgress.murojaahPercent = Math.min(100, (state.quranProgress.murojaahPercent || 0) + 5);
    saveData('quranProgress', state.quranProgress);
    markJourney('murojaah');
  }

  // ========== QUIZ ==========
  // Approximate starting surah for each Juz (1-30)
  const JUZ_START_SURAH = {
    1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8,
    11: 9, 12: 11, 13: 12, 14: 15, 15: 17, 16: 18, 17: 21, 18: 23, 19: 25, 20: 27,
    21: 29, 22: 33, 23: 36, 24: 39, 25: 41, 26: 46, 27: 51, 28: 58, 29: 67, 30: 78
  };

  // Representative surahs per juz for quiz (avoids loading huge surahs)
  const JUZ_QUIZ_SURAHS = {
    1: [1, 2], 2: [2], 3: [2, 3], 4: [3, 4], 5: [4], 6: [4, 5], 7: [5, 6], 8: [6, 7],
    9: [7], 10: [8, 9], 11: [9, 10], 12: [11, 12], 13: [12, 13], 14: [15, 16], 15: [17, 18],
    16: [18, 19], 17: [21, 22], 18: [23, 24], 19: [25, 26], 20: [27, 28], 21: [29, 30],
    22: [33, 34], 23: [36, 37], 24: [39, 40], 25: [41, 42], 26: [46, 47], 27: [51, 52],
    28: [58, 59], 29: [67, 68, 69], 30: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
  };

  let quizState = null;

  function initQuizPage() {
    const juzSel = document.getElementById('quizJuzSelect');
    if (juzSel) {
      juzSel.innerHTML = Array.from({ length: 30 }, (_, i) =>
        `<option value="${i + 1}">Juz ${i + 1}</option>`
      ).join('');
    }
    const surahSel = document.getElementById('quizSurahSelect');
    if (surahSel) {
      surahSel.innerHTML = QuranService.surahs.map(s =>
        `<option value="${s.n}">${s.n}. ${s.en}</option>`
      ).join('');
    }
  }

  async function startQuiz() {
    const scope = document.querySelector('input[name="quizScope"]:checked')?.value || 'surah';
    const diff = document.querySelector('input[name="quizDiff"]:checked')?.value || 'easy';
    const startBtn = document.getElementById('startQuiz');
    const origText = startBtn ? startBtn.textContent : '';

    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = 'Loading…';
    }

    try {
      let ayahs = [];
      let scopeLabel = '';

      if (scope === 'surah') {
        const num = +document.getElementById('quizSurahSelect').value || 112;
        const meta = QuranService.surahs.find(s => s.n === num);
        scopeLabel = meta ? meta.en : `Surah ${num}`;
        const data = await QuranService.fetchSurah(num);
        if (!data || !data.ayahs || data.ayahs.length < 2) {
          throw new Error('Could not load this surah. Try another one.');
        }
        ayahs = data.ayahs.map(a => ({ n: a.number, ar: a.arabic, en: a.translation }));
      } else {
        const juz = +document.getElementById('quizJuzSelect').value || 30;
        scopeLabel = `Juz ${juz}`;
        const surahNums = JUZ_QUIZ_SURAHS[juz] || [JUZ_START_SURAH[juz] || 1];
        // Load up to 3 surahs from the juz (to keep it manageable)
        const toLoad = surahNums.slice(0, diff === 'hard' ? 3 : diff === 'medium' ? 2 : 1);
        for (const sn of toLoad) {
          const data = await QuranService.fetchSurah(sn);
          if (data && data.ayahs) {
            ayahs.push(...data.ayahs.map(a => ({
              n: a.number,
              ar: a.arabic,
              en: a.translation,
              surah: data.englishName,
              surahNum: sn
            })));
          }
        }
        if (ayahs.length < 2) throw new Error('Could not load ayahs for this Juz.');
      }

      // Cap ayahs for very long surahs based on difficulty
      const maxAyahs = diff === 'easy' ? 15 : diff === 'medium' ? 30 : 50;
      if (ayahs.length > maxAyahs) {
        // Take a random window of ayahs so quiz stays focused
        const start = Math.floor(Math.random() * Math.max(1, ayahs.length - maxAyahs));
        ayahs = ayahs.slice(start, start + maxAyahs);
      }

      const questions = buildQuizQuestions(ayahs, diff);
      if (questions.length < 1) {
        throw new Error('Not enough ayahs to build a quiz. Try a longer surah or different juz.');
      }

      quizState = {
        questions,
        index: 0,
        correct: 0,
        mistakes: [],
        scopeLabel
      };

      document.getElementById('quizSetup').hidden = true;
      document.getElementById('quizScreen').hidden = false;
      document.getElementById('quizResult').hidden = true;
      showQuizQuestion();
    } catch (err) {
      alert(err.message || 'Failed to start quiz. Check your connection and try again.');
    } finally {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = origText || 'Start Quiz';
      }
    }
  }

  function buildQuizQuestions(ayahs, diff) {
    const questions = [];
    const questionCount = diff === 'easy' ? 5 : diff === 'medium' ? 8 : 10;

    // Type 1: Continue the Ayah
    for (let i = 0; i < ayahs.length - 1 && questions.length < questionCount; i++) {
      if (Math.random() > 0.55 && questions.length > 2) continue;
      const correct = ayahs[i + 1];
      const options = [{ text: correct.ar, correct: true, n: correct.n }];
      let attempts = 0;
      while (options.length < 4 && attempts < 30) {
        attempts++;
        const rand = ayahs[Math.floor(Math.random() * ayahs.length)];
        if (!options.find(o => o.n === rand.n) && rand.ar !== correct.ar) {
          options.push({ text: rand.ar, correct: false, n: rand.n });
        }
      }
      if (options.length < 2) continue;
      shuffle(options);
      questions.push({
        type: 'Continue the Ayah',
        prompt: ayahs[i].ar,
        options,
        correctAyah: correct
      });
    }

    // Type 2: What Comes Next? (show translation prompt, pick Arabic) — medium/hard
    if (diff !== 'easy') {
      for (let i = 0; i < ayahs.length - 1 && questions.length < questionCount; i++) {
        if (!ayahs[i].en || Math.random() > 0.4) continue;
        const correct = ayahs[i + 1];
        const options = [{ text: correct.ar, correct: true, n: correct.n }];
        let attempts = 0;
        while (options.length < 4 && attempts < 30) {
          attempts++;
          const rand = ayahs[Math.floor(Math.random() * ayahs.length)];
          if (!options.find(o => o.n === rand.n)) {
            options.push({ text: rand.ar, correct: false, n: rand.n });
          }
        }
        if (options.length < 2) continue;
        shuffle(options);
        questions.push({
          type: 'What Comes Next?',
          prompt: ayahs[i].en,
          options,
          correctAyah: correct
        });
      }
    }

    // Type 3: Surah Match (hard only) — which surah does this ayah belong to
    if (diff === 'hard' && ayahs.some(a => a.surah)) {
      const withSurah = ayahs.filter(a => a.surah);
      for (let i = 0; i < withSurah.length && questions.length < questionCount; i++) {
        if (Math.random() > 0.5) continue;
        const a = withSurah[i];
        const allNames = [...new Set(withSurah.map(x => x.surah))];
        if (allNames.length < 2) break;
        const options = [{ text: a.surah, correct: true }];
        while (options.length < Math.min(4, allNames.length)) {
          const rand = allNames[Math.floor(Math.random() * allNames.length)];
          if (!options.find(o => o.text === rand)) {
            options.push({ text: rand, correct: false });
          }
        }
        shuffle(options);
        questions.push({
          type: 'Surah Match',
          prompt: a.ar,
          options,
          correctAyah: a
        });
      }
    }

    // Shuffle final set and limit
    shuffle(questions);
    return questions.slice(0, questionCount);
  }

  function showQuizQuestion() {
    if (!quizState || !quizState.questions[quizState.index]) return;
    const q = quizState.questions[quizState.index];
    document.getElementById('quizScopeLabel').textContent = quizState.scopeLabel;
    document.getElementById('quizQuestionNum').textContent =
      `Question ${String(quizState.index + 1).padStart(2, '0')} / ${String(quizState.questions.length).padStart(2, '0')}`;
    document.getElementById('quizProgressFill').style.width =
      `${(quizState.index / quizState.questions.length) * 100}%`;
    document.getElementById('quizType').textContent = q.type;
    document.getElementById('quizArabic').textContent = q.prompt;
    document.getElementById('quizArabic').dir = q.type === 'What Comes Next?' ? 'ltr' : 'rtl';
    document.getElementById('quizFeedback').hidden = true;
    document.getElementById('quizActions').hidden = true;

    const opts = document.getElementById('quizOptions');
    opts.innerHTML = q.options.map((o, i) =>
      `<button class="quiz-opt" data-idx="${i}" dir="${o.text && /[\u0600-\u06FF]/.test(o.text) ? 'rtl' : 'ltr'}">${o.text}</button>`
    ).join('');

    opts.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => selectQuizOption(+btn.dataset.idx));
    });
  }

  function selectQuizOption(idx) {
    const q = quizState.questions[quizState.index];
    const opts = document.querySelectorAll('.quiz-opt');
    opts.forEach(o => o.disabled = true);

    const selected = q.options[idx];
    const feedback = document.getElementById('quizFeedback');
    feedback.hidden = false;

    if (selected.correct) {
      opts[idx].classList.add('correct');
      feedback.className = 'quiz-feedback correct';
      feedback.textContent = '✓ Correct · Alhamdulillah.';
      quizState.correct++;
    } else {
      opts[idx].classList.add('wrong');
      const correctIdx = q.options.findIndex(o => o.correct);
      if (correctIdx >= 0) opts[correctIdx].classList.add('correct');
      feedback.className = 'quiz-feedback wrong';
      feedback.textContent = 'Not quite. Take another look at this ayah.';
      quizState.mistakes.push(q);
    }

    document.getElementById('quizActions').hidden = false;
  }

  function nextQuizQuestion() {
    quizState.index++;
    if (quizState.index >= quizState.questions.length) {
      finishQuiz();
    } else {
      showQuizQuestion();
    }
  }

  function finishQuiz() {
    const total = quizState.questions.length;
    const pct = Math.round((quizState.correct / total) * 100);
    document.getElementById('quizScreen').hidden = true;
    document.getElementById('quizResult').hidden = false;
    document.getElementById('quizScore').textContent = `${quizState.correct} / ${total}`;
    document.getElementById('quizPct').textContent = pct + '%';
    document.getElementById('quizSummary').textContent =
      `${quizState.correct} correct · ${quizState.mistakes.length} to review`;

    state.quizHistory.push({
      date: new Date().toISOString(),
      score: quizState.correct,
      total,
      pct
    });
    saveData('quizHistory', state.quizHistory);
    markJourney('quiz');
  }

  // ========== CYCLE ==========
  function renderCycle() {
    const cycle = state.cycle;
    let dayNum = '—';
    let estPeriod = '—';
    let estNext = '—';

    if (cycle.lastPeriodStart) {
      const start = new Date(cycle.lastPeriodStart);
      const now = new Date();
      const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      const cycleDay = (diffDays % cycle.cycleLength) + 1;
      dayNum = cycleDay;

      // Estimate next period
      const nextStart = new Date(start);
      nextStart.setDate(nextStart.getDate() + cycle.cycleLength * Math.ceil((diffDays + 1) / cycle.cycleLength));
      estNext = nextStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

      const periodEnd = new Date(start);
      periodEnd.setDate(periodEnd.getDate() + cycle.periodLength - 1);
      if (cycleDay <= cycle.periodLength) {
        estPeriod = `Day ${cycleDay} of period`;
      } else {
        estPeriod = `Est. ${estNext}`;
      }
    }

    document.getElementById('cycleCurrentDay').textContent = dayNum;
    document.getElementById('cycleEstPeriod').textContent = estPeriod;
    document.getElementById('cycleEstNext').textContent = estNext;
    document.getElementById('cycleDay').textContent = dayNum;
    document.getElementById('cycleNext').textContent = estNext;

    if (cycle.notes) {
      document.getElementById('cycleNotes').value = cycle.notes;
    }

    // Simple calendar highlight
    renderCycleCalendar();
  }

  function renderCycleCalendar() {
    const container = document.getElementById('cycleCalendar');
    if (!container) return;
    // Reuse similar structure to journal calendar
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();
    const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    let periodDays = new Set();
    if (state.cycle.lastPeriodStart) {
      const start = new Date(state.cycle.lastPeriodStart);
      for (let i = 0; i < state.cycle.periodLength; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if (d.getMonth() === month && d.getFullYear() === year) {
          periodDays.add(d.getDate());
        }
      }
    }

    let daysHtml = '';
    for (let i = 0; i < startDay; i++) daysHtml += `<div class="cal-day other-month"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === now.getDate();
      const isPeriod = periodDays.has(d);
      daysHtml += `<div class="cal-day ${isToday ? 'today' : ''} ${isPeriod ? 'has-entry' : ''}" style="${isPeriod ? 'background:rgba(184,138,126,0.2);color:var(--muted-rose);' : ''}">${d}</div>`;
    }

    container.innerHTML = `
      <div class="cal-header"><span>${monthName}</span></div>
      <div class="cal-grid">
        <div class="cal-day-name">Su</div><div class="cal-day-name">Mo</div><div class="cal-day-name">Tu</div>
        <div class="cal-day-name">We</div><div class="cal-day-name">Th</div><div class="cal-day-name">Fr</div>
        <div class="cal-day-name">Sa</div>
        ${daysHtml}
      </div>`;
  }

  // ========== JOURNEY ==========
  function markJourney(key) {
    if (state.journeyToday[key]) return;
    state.journeyToday[key] = true;
    saveData('journeyToday', state.journeyToday);
    updateJourneyUI();
  }

  function updateJourneyUI() {
    const keys = ['morningAdhkar', 'quran', 'murojaah', 'journal', 'quiz', 'eveningAdhkar'];
    const labels = {
      morningAdhkar: 'Morning Adhkar',
      quran: 'Qur\'an',
      murojaah: 'Murojaah',
      journal: 'Journal',
      quiz: 'Quiz',
      eveningAdhkar: 'Evening Adhkar'
    };
    let done = 0;
    const container = document.getElementById('journeyActions');
    if (container) {
      container.innerHTML = keys.map(k => {
        const isDone = state.journeyToday[k];
        if (isDone) done++;
        return `
          <div class="journey-item ${isDone ? 'done' : ''}">
            <span class="check"></span>
            <span>${labels[k]}</span>
          </div>`;
      }).join('');
    }
    const text = document.getElementById('journeyProgressText');
    const fill = document.getElementById('journeyProgressFill');
    if (text) text.textContent = `${done} / 6 completed`;
    if (fill) fill.style.width = `${(done / 6) * 100}%`;

    // Murojaah progress on home
    const mp = document.getElementById('murojaahProgress');
    const mpp = document.getElementById('murojaahPercent');
    if (mp) mp.style.width = (state.quranProgress.murojaahPercent || 0) + '%';
    if (mpp) mpp.textContent = (state.quranProgress.murojaahPercent || 0) + '%';
  }

  function updateHomeUI() {
    updateJourneyUI();
    renderCycle();
  }

  // ========== PROGRESS PAGE ==========
  function renderProgress() {
    const grid = document.getElementById('progressGrid');
    if (!grid) return;

    const morningDone = Object.values(state.adhkarProgress.morning || {}).filter((v, i) => {
      const item = ADHKAR_DATA.morning[i];
      return item && v >= item.count;
    }).length;
    const eveningDone = Object.values(state.adhkarProgress.evening || {}).filter((v, i) => {
      const item = ADHKAR_DATA.evening[i];
      return item && v >= item.count;
    }).length;

    grid.innerHTML = `
      <div class="progress-card">
        <h3>Qur'an</h3>
        <div class="progress-stat"><span>Last read</span><span class="val">${QuranService.surahs.find(s => s.n === state.quranProgress.lastSurah)?.en || '—'}</span></div>
        <div class="progress-stat"><span>Murojaah progress</span><span class="val">${state.quranProgress.murojaahPercent || 0}%</span></div>
      </div>
      <div class="progress-card">
        <h3>Murojaah</h3>
        <div class="progress-stat"><span>Sessions</span><span class="val">${state.quranProgress.sessions || 0}</span></div>
      </div>
      <div class="progress-card">
        <h3>Adhkar</h3>
        <div class="progress-stat"><span>Morning</span><span class="val">${morningDone} / ${ADHKAR_DATA.morning.length}</span></div>
        <div class="progress-stat"><span>Evening</span><span class="val">${eveningDone} / ${ADHKAR_DATA.evening.length}</span></div>
      </div>
      <div class="progress-card">
        <h3>Journal</h3>
        <div class="progress-stat"><span>Entries</span><span class="val">${state.journal.length}</span></div>
      </div>
      <div class="progress-card">
        <h3>Quiz</h3>
        <div class="progress-stat"><span>Completed</span><span class="val">${state.quizHistory.length}</span></div>
      </div>
    `;
  }

  // ========== SETTINGS ==========
  function openSettings() {
    document.getElementById('settingsModal').hidden = false;
    document.querySelectorAll('.theme-pills .pill').forEach(p => {
      p.classList.toggle('active', p.dataset.theme === state.theme);
    });
    document.getElementById('showTranslation').checked = state.settings.showTranslation;
    document.getElementById('reduceMotion').checked = state.settings.reduceMotion;
    document.getElementById('soundEffects').checked = state.settings.soundEffects;
    document.querySelectorAll('.font-size-ctrl button').forEach(b => b.classList.remove('active'));
    const sizeBtn = { sm: 'setFontSm', md: 'setFontMd', lg: 'setFontLg' }[state.settings.arabicSize];
    document.getElementById(sizeBtn)?.classList.add('active');
  }

  function closeSettings() {
    document.getElementById('settingsModal').hidden = true;
  }

  // ========== UTILITIES ==========
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function confirmDialog(message) {
    return new Promise(resolve => {
      const modal = document.getElementById('confirmModal');
      document.getElementById('confirmMessage').textContent = message;
      modal.hidden = false;
      const ok = document.getElementById('confirmOk');
      const cancel = document.getElementById('confirmCancel');
      const cleanup = (val) => {
        modal.hidden = true;
        ok.onclick = null;
        cancel.onclick = null;
        resolve(val);
      };
      ok.onclick = () => cleanup(true);
      cancel.onclick = () => cleanup(false);
    });
  }

  // ========== EVENT BINDINGS ==========
  function bindEvents() {
    // Theme
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

    // Settings
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('moreSettings')?.addEventListener('click', () => {
      document.getElementById('moreMenu').hidden = true;
      openSettings();
    });
    document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
    document.getElementById('settingsBackdrop')?.addEventListener('click', closeSettings);

    document.querySelectorAll('.theme-pills .pill').forEach(p => {
      p.addEventListener('click', () => applyTheme(p.dataset.theme));
    });

    document.getElementById('setFontSm')?.addEventListener('click', () => {
      state.settings.arabicSize = 'sm';
      saveData('settings', state.settings);
      document.querySelectorAll('.font-size-ctrl button').forEach(b => b.classList.remove('active'));
      document.getElementById('setFontSm').classList.add('active');
    });
    document.getElementById('setFontMd')?.addEventListener('click', () => {
      state.settings.arabicSize = 'md';
      saveData('settings', state.settings);
      document.querySelectorAll('.font-size-ctrl button').forEach(b => b.classList.remove('active'));
      document.getElementById('setFontMd').classList.add('active');
    });
    document.getElementById('setFontLg')?.addEventListener('click', () => {
      state.settings.arabicSize = 'lg';
      saveData('settings', state.settings);
      document.querySelectorAll('.font-size-ctrl button').forEach(b => b.classList.remove('active'));
      document.getElementById('setFontLg').classList.add('active');
    });

    document.getElementById('showTranslation')?.addEventListener('change', (e) => {
      state.settings.showTranslation = e.target.checked;
      showTrans = e.target.checked;
      saveData('settings', state.settings);
    });
    document.getElementById('reduceMotion')?.addEventListener('change', (e) => {
      state.settings.reduceMotion = e.target.checked;
      saveData('settings', state.settings);
    });

    document.getElementById('exportJournal')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.journal, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `our-journal-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('clearData')?.addEventListener('click', async () => {
      const ok = await confirmDialog('This will permanently erase all journal entries, progress, and settings on this device. Continue?');
      if (ok) {
        clearAllData();
        location.reload();
      }
    });

    // Navigation
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = el.dataset.nav;
        if (page) navigateTo(page);
      });
    });

    // More menu
    document.getElementById('moreBtn')?.addEventListener('click', () => {
      document.getElementById('moreMenu').hidden = false;
    });
    document.getElementById('moreBackdrop')?.addEventListener('click', () => {
      document.getElementById('moreMenu').hidden = true;
    });

    // Header scroll
    window.addEventListener('scroll', () => {
      document.getElementById('siteHeader')?.classList.toggle('scrolled', window.scrollY > 40);
    });

    // Return top
    document.getElementById('returnTop')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Home reflection
    let homeMood = null;
    document.querySelectorAll('#homeMoods .mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#homeMoods .mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        homeMood = btn.dataset.mood;
      });
    });
    document.getElementById('saveHomeReflection')?.addEventListener('click', () => {
      const text = document.getElementById('homeReflection').value;
      if (!text.trim()) return;
      saveJournalEntry(text, homeMood, []);
      document.getElementById('homeReflection').value = '';
      document.querySelectorAll('#homeMoods .mood-btn').forEach(b => b.classList.remove('active'));
      homeMood = null;
      // subtle feedback
      const btn = document.getElementById('saveHomeReflection');
      const orig = btn.textContent;
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });

    // Journal page
    let journalMood = null;
    document.querySelectorAll('#journalMoods .mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#journalMoods .mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        journalMood = btn.dataset.mood;
      });
    });
    document.getElementById('saveJournal')?.addEventListener('click', () => {
      const text = document.getElementById('journalText').value;
      const g1 = document.getElementById('gratitude1').value;
      const g2 = document.getElementById('gratitude2').value;
      saveJournalEntry(text, journalMood, [g1, g2]);
      document.getElementById('journalText').value = '';
      document.getElementById('gratitude1').value = '';
      document.getElementById('gratitude2').value = '';
      document.querySelectorAll('#journalMoods .mood-btn').forEach(b => b.classList.remove('active'));
      journalMood = null;
      const btn = document.getElementById('saveJournal');
      const orig = btn.textContent;
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
    document.getElementById('closeEntry')?.addEventListener('click', closeEntry);

    // Adhkar tabs
    document.querySelectorAll('#adhkar .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#adhkar .tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        renderAdhkar(tab.dataset.tab);
      });
    });
    document.getElementById('enterFocusMode')?.addEventListener('click', enterFocusMode);
    document.getElementById('exitFocusMode')?.addEventListener('click', () => {
      document.getElementById('focusOverlay').hidden = true;
      renderAdhkar(currentAdhkarTab);
    });
    document.getElementById('focusTap')?.addEventListener('click', focusTap);

    // Qur'an tabs
    document.querySelectorAll('#quran .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#quran .tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        document.querySelectorAll('.quran-panel').forEach(p => {
          p.hidden = true;
          p.classList.remove('active');
        });
        document.getElementById('quranReader').hidden = true;
        const panelId = { read: 'quranRead', murojaah: 'quranMurojaah', progress: 'quranProgress' }[tab.dataset.qtab];
        const panel = document.getElementById(panelId);
        if (panel) {
          panel.hidden = false;
          panel.classList.add('active');
        }
      });
    });

    document.getElementById('continueReadingBtn')?.addEventListener('click', () => {
      openReader(state.quranProgress.lastSurah || 67);
    });
    document.getElementById('closeReader')?.addEventListener('click', closeReader);
    document.getElementById('toggleTranslation')?.addEventListener('click', () => {
      showTrans = !showTrans;
      document.querySelectorAll('.ayah-trans').forEach(el => el.classList.toggle('hidden', !showTrans));
    });
    document.getElementById('fontIncrease')?.addEventListener('click', () => {
      const sizes = ['sm', 'md', 'lg'];
      const idx = Math.min(2, sizes.indexOf(state.settings.arabicSize) + 1);
      state.settings.arabicSize = sizes[idx];
      saveData('settings', state.settings);
      const sizeMap = { sm: '1.25rem', md: '1.55rem', lg: '1.9rem' };
      document.documentElement.style.setProperty('--arabic-size', sizeMap[sizes[idx]]);
    });
    document.getElementById('fontDecrease')?.addEventListener('click', () => {
      const sizes = ['sm', 'md', 'lg'];
      const idx = Math.max(0, sizes.indexOf(state.settings.arabicSize) - 1);
      state.settings.arabicSize = sizes[idx];
      saveData('settings', state.settings);
      const sizeMap = { sm: '1.25rem', md: '1.55rem', lg: '1.9rem' };
      document.documentElement.style.setProperty('--arabic-size', sizeMap[sizes[idx]]);
    });
    document.getElementById('surahSearch')?.addEventListener('input', (e) => {
      renderSurahList(e.target.value);
    });

    // Murojaah
    document.querySelectorAll('input[name="muroType"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('muroJuzSelect').hidden = r.value !== 'juz';
        document.getElementById('muroSurahSelect').hidden = r.value !== 'surah';
      });
    });
    document.getElementById('startMurojaah')?.addEventListener('click', startMurojaah);
    document.getElementById('startRecitation')?.addEventListener('click', startRecitation);
    document.getElementById('skipAyah')?.addEventListener('click', () => {
      if (muroSession) { muroSession.review++; nextMuroAyah(); }
    });
    document.getElementById('revealAyah')?.addEventListener('click', () => {
      document.getElementById('muroAyah')?.classList.remove('hidden-mode');
    });
    document.getElementById('muroDone')?.addEventListener('click', () => {
      document.getElementById('murojaahResult').hidden = true;
      document.getElementById('murojaahSetup').hidden = false;
      muroSession = null;
    });
    document.getElementById('reviewAgain')?.addEventListener('click', () => {
      document.getElementById('murojaahResult').hidden = true;
      document.getElementById('murojaahSetup').hidden = false;
      muroSession = null;
    });

    // Quiz
    document.querySelectorAll('input[name="quizScope"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('quizJuzSelect').hidden = r.value !== 'juz';
        document.getElementById('quizSurahSelect').hidden = r.value !== 'surah';
      });
    });
    document.getElementById('startQuiz')?.addEventListener('click', startQuiz);
    document.getElementById('nextQuestionBtn')?.addEventListener('click', nextQuizQuestion);
    document.getElementById('tryAnotherQuiz')?.addEventListener('click', () => {
      document.getElementById('quizResult').hidden = true;
      document.getElementById('quizSetup').hidden = false;
    });
    document.getElementById('reviewMistakes')?.addEventListener('click', () => {
      if (quizState?.mistakes?.length) {
        // Open first mistake surah in reader if possible
        navigateTo('quran');
      }
    });

    // Cycle
    document.getElementById('logPeriod')?.addEventListener('click', () => {
      const val = document.getElementById('periodStartDate').value;
      if (!val) return;
      state.cycle.lastPeriodStart = val;
      saveData('cycle', state.cycle);
      renderCycle();
    });
    document.getElementById('saveCycleNotes')?.addEventListener('click', () => {
      state.cycle.notes = document.getElementById('cycleNotes').value;
      saveData('cycle', state.cycle);
      const btn = document.getElementById('saveCycleNotes');
      const orig = btn.textContent;
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });

    // City modal
    document.getElementById('closeCity')?.addEventListener('click', closeCityModal);
    document.getElementById('cityBackdrop')?.addEventListener('click', closeCityModal);
    document.querySelectorAll('.city-item').forEach(item => {
      item.addEventListener('click', () => {
        state.location = {
          lat: +item.dataset.lat,
          lng: +item.dataset.lng,
          city: item.dataset.city
        };
        saveData('location', state.location);
        closeCityModal();
        loadPrayerTimes();
      });
    });

    // Action cards with tab targets
    document.querySelectorAll('[data-adhkar-tab]').forEach(el => {
      el.addEventListener('click', () => {
        setTimeout(() => {
          const tab = el.dataset.adhkarTab;
          const tabBtn = document.querySelector(`#adhkar .tab[data-tab="${tab}"]`);
          tabBtn?.click();
        }, 100);
      });
    });
    document.querySelectorAll('[data-quran-tab]').forEach(el => {
      el.addEventListener('click', () => {
        setTimeout(() => {
          const tab = el.dataset.quranTab;
          const tabBtn = document.querySelector(`#quran .tab[data-qtab="${tab}"]`);
          tabBtn?.click();
        }, 100);
      });
    });
  }

  // ========== INIT ==========
  function init() {
    hydrateState();
    applyTheme(state.theme);
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(updateNextPrayerUI, 1000);
    initCursor();
    bindEvents();
    setJournalPrompt();
    updateHomeUI();
    renderJournalHistory();
    loadPrayerTimes();

    // Prefer reduced motion from system
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.settings.reduceMotion = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
