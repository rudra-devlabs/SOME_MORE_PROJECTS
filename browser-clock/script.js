(() => {
  const tabs = document.querySelectorAll('.tab-link');
  const contents = document.querySelectorAll('.tab-content');

  if (tabs.length === 0) return; // Prevent errors if DOM isn't fully loaded somehow, though it should be

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  const closePipBtn = document.getElementById('close-pip');
  if (closePipBtn) {
    closePipBtn.addEventListener('click', () => {
      window.parent.postMessage({ action: 'closePip' }, '*');
    });
  }

  // Flip Clock Logic
  function createFlipClock(container) {
    const cardHTML = `
      <div class="flip-card">
        <div class="top">0</div>
        <div class="bottom">0</div>
        <div class="flip-top">0</div>
        <div class="flip-bottom">0</div>
      </div>
    `;
    container.innerHTML = `
      <div class="sign" style="display: none; font-size: 60px; margin-right: 5px; color: #ff3b5b;">-</div>
      ${cardHTML}${cardHTML}
      <div class="separator">:</div>
      ${cardHTML}${cardHTML}
      <div class="separator">:</div>
      ${cardHTML}${cardHTML}
    `;
  }

  function updateFlipClock(container, time) {
    const parts = time.split('');
    const cards = container.querySelectorAll('.flip-card');
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const top = card.querySelector('.top');
      const bottom = card.querySelector('.bottom');
      const flipTop = card.querySelector('.flip-top');
      const flipBottom = card.querySelector('.flip-bottom');
      
      const current = top.innerText;
      const next = parts[i];
      
      if (current !== next) {
        top.innerText = next;
        flipTop.innerText = current;
        flipBottom.innerText = next;
        bottom.innerText = current;
        
        card.classList.remove('flipping');
        void card.offsetWidth; 
        card.classList.add('flipping');
        
        setTimeout(() => {
          bottom.innerText = next;
        }, 600);
      }
    }
  }
  
  const clockContainer = document.querySelector('#clock .flip-clock');
  createFlipClock(clockContainer);

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    updateFlipClock(clockContainer, `${hours}${minutes}${seconds}`);
  }

  setInterval(updateClock, 1000);
  updateClock();

  // Stopwatch
  const stopwatchContainer = document.querySelector('#stopwatch .flip-clock');
  createFlipClock(stopwatchContainer);
  let stopwatchInterval;
  let stopwatchTime = 0;
  let running = false;
  
  const playIcon = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  const toggleStopwatchBtn = document.getElementById('toggle-stopwatch');

  toggleStopwatchBtn.addEventListener('click', () => {
    if (running) {
      running = false;
      clearInterval(stopwatchInterval);
      toggleStopwatchBtn.innerHTML = playIcon;
    } else {
      running = true;
      toggleStopwatchBtn.innerHTML = pauseIcon;
      stopwatchInterval = setInterval(() => {
        stopwatchTime++;
        const hours = String(Math.floor(stopwatchTime / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((stopwatchTime % 3600) / 60)).padStart(2, '0');
        const seconds = String(stopwatchTime % 60).padStart(2, '0');
        updateFlipClock(stopwatchContainer, `${hours}${minutes}${seconds}`);
      }, 1000);
    }
  });

  document.getElementById('reset-stopwatch').addEventListener('click', () => {
    running = false;
    clearInterval(stopwatchInterval);
    stopwatchTime = 0;
    updateFlipClock(stopwatchContainer, '000000');
    document.getElementById('laps').innerHTML = '';
    toggleStopwatchBtn.innerHTML = playIcon;
  });

  document.getElementById('lap-stopwatch').addEventListener('click', () => {
    if (stopwatchTime > 0) {
        const hours = String(Math.floor(stopwatchTime / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((stopwatchTime % 3600) / 60)).padStart(2, '0');
        const seconds = String(stopwatchTime % 60).padStart(2, '0');
        const lapTime = `${hours}:${minutes}:${seconds}`;
        const li = document.createElement('li');
        li.innerText = lapTime;
        document.getElementById('laps').prepend(li);
    }
  });

  // Timer
  function playAlarmSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    function beep(freq, startTime, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
    beep(880, ctx.currentTime, 0.2);
    beep(880, ctx.currentTime + 0.25, 0.2);
    beep(880, ctx.currentTime + 0.5, 0.2);
  }

  const timerContainer = document.querySelector('#timer .flip-clock');
  createFlipClock(timerContainer);
  const timerSign = timerContainer.querySelector('.sign');
  let timerInterval;
  let timerTime = 0;
  let timerRunning = false;
  let hasStarted = false;

  const toggleTimerBtn = document.getElementById('toggle-timer');
  const timerHoursInput = document.getElementById('timer-hours');
  const timerMinutesInput = document.getElementById('timer-minutes');
  const timerSecondsInput = document.getElementById('timer-seconds');

  function clearTimerInputValidity() {
    timerHoursInput.setCustomValidity('');
    timerMinutesInput.setCustomValidity('');
    timerSecondsInput.setCustomValidity('');
  }

  function reportTimerInputError(message, field) {
    field.setCustomValidity(message);
    field.reportValidity();
  }

  function parseTimerInputs() {
    const rawHours = timerHoursInput.value.trim();
    const rawMinutes = timerMinutesInput.value.trim();
    const rawSeconds = timerSecondsInput.value.trim();

    const hours = rawHours === '' ? 0 : parseInt(rawHours, 10);
    const minutes = rawMinutes === '' ? 0 : parseInt(rawMinutes, 10);
    const seconds = rawSeconds === '' ? 0 : parseInt(rawSeconds, 10);

    if ([hours, minutes, seconds].some(value => Number.isNaN(value) || value < 0)) {
      reportTimerInputError('Please enter non-negative numbers.', timerHoursInput);
      return null;
    }

    if (minutes > 59) {
      reportTimerInputError('Minutes must be between 0 and 59.', timerMinutesInput);
      return null;
    }

    if (seconds > 59) {
      reportTimerInputError('Seconds must be between 0 and 59.', timerSecondsInput);
      return null;
    }

    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

    if (totalSeconds <= 0) {
      reportTimerInputError('Set a time greater than 00:00:00.', timerHoursInput);
      return null;
    }

    return totalSeconds;
  }

  function handleTimerTick() {
    timerTime--;
    if (timerTime <= 0) {
      playAlarmSound();
    }
    if (timerTime < 0) {
      if(timerSign) timerSign.style.display = 'block';
    } else {
      if(timerSign) timerSign.style.display = 'none';
    }
    
    const absTime = Math.abs(timerTime);
    const hours = String(Math.floor(absTime / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((absTime % 3600) / 60)).padStart(2, '0');
    const seconds = String(absTime % 60).padStart(2, '0');
    updateFlipClock(timerContainer, `${hours}${minutes}${seconds}`);
  }

  toggleTimerBtn.addEventListener('click', () => {
    if (timerRunning) {
      timerRunning = false;
      clearInterval(timerInterval);
      toggleTimerBtn.innerHTML = playIcon;
    } else {
      if (!hasStarted) {
        clearTimerInputValidity();
        const inputSeconds = parseTimerInputs();
        if (inputSeconds > 0) {
          timerTime = inputSeconds;
          hasStarted = true;
        } else {
          return;
        }
      }

      if (hasStarted) {
        clearTimerInputValidity();
        timerRunning = true;
        toggleTimerBtn.innerHTML = pauseIcon;
        timerInterval = setInterval(handleTimerTick, 1000);
      }
    }
  });

  document.getElementById('reset-timer').addEventListener('click', () => {
    timerRunning = false;
    hasStarted = false;
    clearInterval(timerInterval);
    timerTime = 0;
    if(timerSign) timerSign.style.display = 'none';
    updateFlipClock(timerContainer, '000000');
    timerHoursInput.value = '';
    timerMinutesInput.value = '';
    timerSecondsInput.value = '';
    clearTimerInputValidity();
    toggleTimerBtn.innerHTML = playIcon;
  });
})();