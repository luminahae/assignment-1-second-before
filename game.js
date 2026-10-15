/* =========================================================================
 * game.js — 과제 제출 1초 전 : 메인 게임 로직
 * data.js(콘텐츠) + audio.js(효과음) 를 사용합니다.
 * ======================================================================= */

(() => {
  'use strict';
  const D = window.GAME_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const rnd = (a, b) => a + Math.random() * (b - a);        // 실수 랜덤
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));          // 정수 랜덤 [a,b]
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);

  /* ----------------------------- 게임 상태 ----------------------------- */
  let state = null;
  let rafId = null;
  let timerId = null;
  let eventTimer = 0;      // 다음 사건까지 남은 시간(초)
  let lastTs = 0;

  function freshState(level) {
    const subj = pick(D.SUBJECTS);
    return {
      level: level.id,
      levelName: level.name,
      levelCfg: level,
      course: subj.course,
      task: subj.task,
      time: level.time,     // 남은 시간(초) — 레벨별
      startTime: level.time,
      mental: level.mental,
      teamTrust: 70,
      profSuspicion: 20,
      completeness: 55,
      net: 'online',        // 'online' | 'weak' | 'off'
      canSubmit: true,      // 용량 초과 등으로 잠기면 false
      selected: null,       // 선택된 파일 객체
      files: [],
      logs: [],
      flags: {},
      running: true,
      uploading: false,
      uploadProgress: 0,
      uploadDone: false,
      uploadFile: null,
      submitted: false,
      submittedFile: null,
      timeAtSubmit: null,
      usedFinalChoices: [],
      eventsFired: {},
      log(msg) {
        this.logs.unshift(msg);
        if (this.logs.length > 40) this.logs.pop();
        renderLog();
      },
    };
  }

  /* ------------------------- 파일 생성 (랜덤) --------------------------- */
  function timeLabel(minsAgo) {
    if (minsAgo < 1) return '방금 전';
    if (minsAgo < 60) return `${Math.round(minsAgo)}분 전`;
    if (minsAgo < 60 * 24) return `${Math.round(minsAgo / 60)}시간 전`;
    return `${Math.round(minsAgo / (60 * 24))}일 전`;
  }

  function generateFiles(level) {
    const pool = D.FILE_POOL;
    const candidates = pool.filter(f => f.kind === 'candidate');
    const traps = pool.filter(f => f.kind === 'trap');
    const decoys = pool.filter(f => f.kind === 'decoy');

    // 레벨별 전체 파일 수 / 함정 수 결정
    const total = rndi(level.files[0], level.files[1]);
    const trapCount = Math.min(rndi(level.traps[0], level.traps[1]), traps.length);
    const rest = total - trapCount;
    // 나머지를 후보(55%) / 가짜(45%)로 분배 (후보는 최소 2개 보장)
    let candCount = Math.max(2, Math.round(rest * 0.55));
    candCount = Math.min(candCount, candidates.length);
    let decoyCount = Math.min(rest - candCount, decoys.length);
    if (decoyCount < 0) decoyCount = 0;

    const chosen = [
      ...shuffle(candidates).slice(0, candCount),
      ...shuffle(traps).slice(0, trapCount),
      ...shuffle(decoys).slice(0, decoyCount),
    ];
    const chosenShuffled = shuffle(chosen);

    // 진짜 제출 파일 = 뽑힌 candidate 중 하나
    const candIds = chosenShuffled.filter(f => f.kind === 'candidate');
    const correctSrc = pick(candIds);

    const files = chosenShuffled.map((src, i) => {
      const isCorrect = src === correctSrc;
      const isFolder = src.ext === '' && src.base.startsWith('새 폴더');
      const isZip = src.ext === 'zip';
      const isEmpty = !!src.empty;
      const badExt = src.ext === 'pptx.pdf';

      // 단서 값 결정 (정답은 좋은 단서 조합, 일부 가짜도 '그럴듯'하게)
      let font, image, isTeamLatest, size, minsAgo, submittable;

      if (isCorrect) {
        font = '정상';
        image = '포함';
        isTeamLatest = true;
        size = rnd(8, 24);
        minsAgo = rnd(0.2, 4);        // 가장 최신
        submittable = true;
      } else if (src.kind === 'candidate') {
        // 그럴듯한 가짜: 겉보기 멀쩡하지만 최신본이 아니거나 폰트/이미지가 애매
        font = pick(['정상', '깨짐 위험']);
        image = pick(['포함', '누락']);
        isTeamLatest = false;
        size = rnd(6, 40);
        minsAgo = rnd(20, 60 * 8);    // 더 오래됨
        submittable = true;
      } else {
        // 함정/가짜
        font = isEmpty ? '없음' : pick(['깨짐 위험', '정상', '없음']);
        image = isEmpty ? '없음' : pick(['누락', '없음', '포함']);
        isTeamLatest = false;
        size = isFolder ? 0 : (isZip ? rnd(300, 620) : rnd(1, 90));
        minsAgo = rnd(10, 60 * 72);
        submittable = !isFolder;      // 폴더는 제출 불가
      }

      const name = src.ext ? `${src.base}.${src.ext}` : src.base;

      // 위험 요소 문구
      const risks = [];
      if (font === '깨짐 위험') risks.push('다른 PC에서 폰트 깨질 수 있음');
      if (font === '없음') risks.push('텍스트가 없음');
      if (image === '누락') risks.push('이미지 링크 깨짐(빨간 X)');
      if (badExt) risks.push('확장자가 .pptx.pdf — 교수님이 못 엶');
      if (isFolder) risks.push('폴더라 제출 불가');
      if (isZip) risks.push('압축 파일 — 열면 지옥');
      if (isEmpty) risks.push('내용이 텅 빈 PDF');
      if (src.wrongSubject) risks.push('이번 과제가 아닌 다른 파일');
      if (size > 100) risks.push(`용량 ${Math.round(size)}MB — 제출 제한 초과`);
      if (!isTeamLatest && src.kind === 'candidate') risks.push('팀원 최신 수정본 아님(구버전)');
      if (risks.length === 0) risks.push('현재까지 발견된 문제 없음');

      return {
        id: 'f' + i,
        name, base: src.base, ext: src.ext, kind: src.kind,
        size: Math.round(size * 10) / 10,
        modifiedMins: minsAgo,
        modified: timeLabel(minsAgo),
        font, image, isTeamLatest,
        submittable,
        isCorrect,
        isFolder, isZip, isEmpty, badExt,
        wrongSubject: !!src.wrongSubject,
        endingTag: src.ending || null,
        note: src.note || '',
        risks,
        // 화면 좌표/속도 (플로팅용)
        x: rnd(4, 78), y: rnd(4, 66),
        vx: rnd(-0.9, 0.9) || 0.4,
        vy: rnd(-0.7, 0.7) || 0.3,
      };
    });

    return files;
  }

  /* ------------------------------ 화면 전환 ---------------------------- */
  function show(screenId) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#' + screenId).classList.add('active');
  }

  /* ============================ 게임 시작 ============================== */
  let currentLevelIdx = 0;          // 지금 플레이 중인 레벨 인덱스(0-based)

  function startGame(levelIdx) {
    SFX.unlock();
    cancelAnimationFrame(rafId);
    clearInterval(timerId);
    clearInterval(uploadInterval);

    if (typeof levelIdx === 'number') currentLevelIdx = levelIdx;
    const level = D.LEVELS[currentLevelIdx] || D.LEVELS[0];

    state = freshState(level);
    state.files = generateFiles(level);
    eventTimer = rndi(Math.max(6, level.eventGap[0] - 6), level.eventGap[1] - 6);
    lastTs = performance.now();

    // 헤더/게이지 초기화
    $('#hdr-course').textContent = state.course;
    $('#hdr-task').textContent = state.task;
    $('#hdr-level').textContent = `Lv.${level.id} ${level.name}`;
    buildDesktop();
    renderLog();
    renderPanel();
    updateHUD();

    // 레벨 시작 토스트
    toast(`Lv.${level.id} · ${level.name}`, level.tip);

    show('game-screen');
    document.body.classList.remove('danger', 'critical');

    timerId = setInterval(tick, 1000);
    rafId = requestAnimationFrame(loop);
  }

  /* --------------------------- 파일 아이콘 DOM ------------------------- */
  function fileIcon(f) {
    // 확장자별 색/라벨
    const ex = f.isFolder ? 'DIR' : (f.ext || '?').toUpperCase();
    const cls = f.isFolder ? 'folder'
      : f.isZip ? 'zip'
      : f.ext === 'pdf' ? 'pdf'
      : f.ext.includes('pptx') ? 'pptx'
      : 'etc';
    return `
      <div class="file-icon ${cls}" data-id="${f.id}" style="left:${f.x}%;top:${f.y}%">
        <div class="ic">${f.isFolder ? '📁' : '<span class="ext">' + ex + '</span>'}</div>
        <div class="fname">${escapeHtml(f.name)}</div>
      </div>`;
  }

  function buildDesktop() {
    const desk = $('#desktop');
    desk.innerHTML = state.files.map(fileIcon).join('');
    $$('.file-icon', desk).forEach(el => {
      el.addEventListener('click', () => selectFile(el.dataset.id));
    });
  }

  /* ----------------------------- 플로팅 루프 -------------------------- */
  function loop(ts) {
    const dt = Math.min(50, ts - lastTs) / 16.67; // 프레임 정규화
    lastTs = ts;
    if (!state || !state.running) { rafId = requestAnimationFrame(loop); return; }

    const urgency = state.time <= 10 ? 2.4 : state.time <= 30 ? 1.5 : 1;
    const speed = urgency * (state.levelCfg ? state.levelCfg.speed : 1);
    const desk = $('#desktop');
    const els = $$('.file-icon', desk);
    for (const f of state.files) {
      f.x += f.vx * dt * speed * 0.25;
      f.y += f.vy * dt * speed * 0.25;
      if (f.x < 1) { f.x = 1; f.vx *= -1; }
      if (f.x > 82) { f.x = 82; f.vx *= -1; }
      if (f.y < 1) { f.y = 1; f.vy *= -1; }
      if (f.y > 74) { f.y = 74; f.vy *= -1; }
    }
    els.forEach(el => {
      const f = state.files.find(x => x.id === el.dataset.id);
      if (f) { el.style.left = f.x + '%'; el.style.top = f.y + '%'; }
    });
    rafId = requestAnimationFrame(loop);
  }

  /* ------------------------------- 타이머 ----------------------------- */
  function tick() {
    if (!state || !state.running) return;
    state.time -= 1;

    // 사건 스케줄 (레벨별 간격)
    eventTimer -= 1;
    if (eventTimer <= 0 && state.time > 6 && !state.modalOpen && !state.uploading) {
      fireRandomEvent();
      const g = state.levelCfg ? state.levelCfg.eventGap : [16, 26];
      eventTimer = rndi(g[0], g[1]);
    }

    // 마지막 10초 카운트다운 강조 + 틱 사운드
    if (state.time <= 10 && state.time > 0) SFX.tick();
    else if (state.time <= 30 && state.time % 5 === 0) SFX.warn();

    // 위험 연출
    document.body.classList.toggle('danger', state.time <= 30);
    document.body.classList.toggle('critical', state.time <= 10);

    updateHUD();

    if (state.time <= 0) {
      state.time = 0;
      updateHUD();
      endGame({ timeout: true });
    }
  }

  /* -------------------------------- HUD ------------------------------- */
  function fmtTime(t) {
    const m = Math.floor(t / 60), s = t % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function updateHUD() {
    const timer = $('#timer');
    timer.textContent = fmtTime(state.time);
    timer.classList.toggle('warn', state.time <= 30);
    timer.classList.toggle('crit', state.time <= 10);
    // 타이머 크기: 시간 줄수록 커짐
    const scale = state.time <= 10 ? 1.35 : state.time <= 30 ? 1.15 : 1;
    timer.style.transform = `scale(${scale})`;

    setGauge('gauge-mental', state.mental);
    setGauge('gauge-trust', state.teamTrust);
    setGauge('gauge-susp', state.profSuspicion);
    setGauge('gauge-comp', state.completeness);

    const netMap = { online: '🟢 연결 양호', weak: '🟡 불안정', off: '🔴 끊김' };
    $('#hdr-net').textContent = netMap[state.net];
    $('#hdr-net').className = 'net net-' + state.net;
  }
  function setGauge(id, val) {
    const el = $('#' + id);
    if (!el) return;
    const bar = $('.g-fill', el);
    const num = $('.g-num', el);
    bar.style.width = clamp(val) + '%';
    num.textContent = clamp(val);
    bar.classList.toggle('low', val < 30);
  }

  /* --------------------------- 파일 선택/정보 -------------------------- */
  function selectFile(id) {
    const f = state.files.find(x => x.id === id);
    if (!f) return;
    state.selected = f;
    SFX.open();

    // 함정 파일을 "열면" 관련 오류가 발생할 수 있음 (제출 아님, 미리보기 단계)
    if (f.isZip && !state.eventsFired['open_zip']) {
      state.eventsFired['open_zip'] = true;
      openModal({
        kind: 'error', who: '압축 프로그램',
        title: '절대열지마세요.zip 을 여시겠습니까?',
        body: '경고: 이 안에는 "새 폴더 (2)" 안에 "새 폴더 (2)" 안에 "새 폴더 (2)"...',
        choices: [
          { label: '닫는다 (현명함)', effect: () => state.log('.zip을 닫았다. 판도라의 상자는 그대로 뒀다.') },
          { label: '끝까지 열어본다 (멘탈↓)', effect: (s) => { s.mental = clamp(s.mental - 10); s.log('폴더의 폴더의 폴더를 열다 길을 잃었다.'); } },
        ],
      });
    } else if (f.badExt && !state.eventsFired['open_badext']) {
      state.eventsFired['open_badext'] = true;
      state.log('이 파일, 확장자가 .pptx.pdf 다. 뭔가 불길하다.');
    }

    renderPanel();
    highlightSelected();
  }

  function highlightSelected() {
    $$('.file-icon').forEach(el => {
      el.classList.toggle('selected', state.selected && el.dataset.id === state.selected.id);
    });
  }

  function renderPanel() {
    const p = $('#file-panel-body');
    const f = state.selected;
    if (!f) {
      p.innerHTML = `<p class="hint">파일을 클릭하면 정보가 여기에 표시됩니다.<br>
        단서(폰트·이미지·용량·수정시간·팀원 최신본·제출 가능 여부)를 종합해<br>
        <b>진짜 제출 파일</b>을 찾아 제출하세요.</p>`;
      $('#btn-submit').disabled = true;
      return;
    }
    const row = (k, v, cls = '') => `<div class="info-row"><span>${k}</span><b class="${cls}">${v}</b></div>`;
    const ok = (b) => b ? 'good' : 'bad';
    const submittableText = f.isFolder ? '불가(폴더)'
      : (f.size > 100 && state.canSubmit === false) ? '불가(용량초과)'
      : '가능';
    p.innerHTML = `
      <div class="sel-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
      ${row('확장자', f.ext || '폴더', f.badExt ? 'bad' : '')}
      ${row('용량', f.isFolder ? '—' : f.size + ' MB', f.size > 100 ? 'bad' : '')}
      ${row('마지막 수정', f.modified)}
      ${row('폰트', f.font, f.font === '정상' ? 'good' : 'bad')}
      ${row('이미지', f.image, f.image === '포함' ? 'good' : (f.image === '없음' ? 'bad' : 'warn'))}
      ${row('팀원 최신 수정본', f.isTeamLatest ? '예 ✔' : '아니오', ok(f.isTeamLatest))}
      ${row('현재 제출 가능', submittableText, submittableText === '가능' ? 'good' : 'bad')}
      <div class="risk-box">
        <div class="risk-title">⚠ 위험 요소</div>
        <ul>${f.risks.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>`;
    $('#btn-submit').disabled = false;
  }

  function renderLog() {
    const box = $('#log-list');
    if (!box) return;
    box.innerHTML = state.logs.slice(0, 8).map(l => `<li>${escapeHtml(l)}</li>`).join('')
      || '<li class="muted">아직 조용하다... 폭풍 전야다.</li>';
  }

  /* ----------------------------- 랜덤 사건 ---------------------------- */
  function fireRandomEvent() {
    // once/이미 발생한 것 제외, 가중치 반영
    const avail = D.EVENTS.filter(e => !(e.once && state.eventsFired[e.id]));
    if (avail.length === 0) return;
    const bag = [];
    avail.forEach(e => { const w = e.weight || 1; for (let i = 0; i < w; i++) bag.push(e); });
    const ev = pick(bag);
    state.eventsFired[ev.id] = true;
    if (ev.kind === 'messenger') SFX.message(); else SFX.error();
    if (ev.kind === 'error') shake();
    openModal(ev);
  }

  /* ------------------------------- 모달 ------------------------------- */
  function openModal(ev) {
    state.modalOpen = true;
    const wrap = $('#modal');
    const kindCls = 'm-' + (ev.kind || 'popup');
    wrap.innerHTML = `
      <div class="modal-card ${kindCls}">
        <div class="modal-head">
          <span class="m-who">${escapeHtml(ev.who || '알림')}</span>
          <span class="m-x">${ev.kind === 'error' ? '⚠' : ev.kind === 'messenger' ? '💬' : '🔔'}</span>
        </div>
        <div class="modal-title">${escapeHtml(ev.title)}</div>
        <div class="modal-body">${escapeHtml(ev.body || '')}</div>
        <div class="modal-choices">
          ${ev.choices.map((c, i) => `<button class="choice" data-i="${i}">${escapeHtml(c.label)}</button>`).join('')}
        </div>
      </div>`;
    wrap.classList.add('open');
    $$('.choice', wrap).forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        const c = ev.choices[+btn.dataset.i];
        try { c.effect(state); } catch (e) { /* noop */ }
        closeModal();
        updateHUD();
        renderPanel();
        if (state.time <= 0 && state.running) endGame({ timeout: true });
      });
    });
  }
  function closeModal() {
    state.modalOpen = false;
    const wrap = $('#modal');
    wrap.classList.remove('open');
    wrap.innerHTML = '';
  }

  /* ---------------------------- 제출 흐름 ----------------------------- */
  function onSubmitClick() {
    const f = state.selected;
    if (!f) return;
    SFX.click();

    // 제출 불가 케이스 즉시 오류
    if (f.isFolder) {
      SFX.error(); shake();
      openModal({ kind: 'error', who: '제출 사이트', title: '폴더는 제출할 수 없습니다',
        body: '"새 폴더"를 통째로 낼 수는 없습니다. 다른 파일을 고르세요.',
        choices: [{ label: '확인', effect: () => {} }] });
      return;
    }
    if (f.size > 100 && state.canSubmit) {
      // 용량 초과 사건을 강제로 띄운다
      const ev = D.EVENTS.find(e => e.id === 'size_over');
      SFX.error(); shake();
      openModal(ev);
      return;
    }

    // 마지막 선택 1개 랜덤 (아직 안 쓴 것)
    const remaining = D.FINAL_CHOICES.filter(fc => !state.usedFinalChoices.includes(fc.id));
    if (remaining.length > 0 && Math.random() < 0.9) {
      const fc = pick(remaining);
      state.usedFinalChoices.push(fc.id);
      openModalThen(fc, () => beginUpload(f));
    } else {
      beginUpload(f);
    }
  }

  // 모달을 띄우고, 어떤 선택을 하든 끝나면 next() 실행
  function openModalThen(ev, next) {
    state.modalOpen = true;
    const wrap = $('#modal');
    wrap.innerHTML = `
      <div class="modal-card m-popup">
        <div class="modal-head"><span class="m-who">제출 확인</span><span class="m-x">❓</span></div>
        <div class="modal-title">${escapeHtml(ev.title)}</div>
        <div class="modal-body">${escapeHtml(ev.body || '')}</div>
        <div class="modal-choices">
          ${ev.choices.map((c, i) => `<button class="choice" data-i="${i}">${escapeHtml(c.label)}</button>`).join('')}
        </div>
      </div>`;
    wrap.classList.add('open');
    $$('.choice', wrap).forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        const c = ev.choices[+btn.dataset.i];
        try { c.effect(state); } catch (e) {}
        closeModal();
        updateHUD();
        if (state.time <= 0) { endGame({ timeout: true }); return; }
        next();
      });
    });
  }

  /* ---------------------------- 업로드 시스템 -------------------------- */
  let uploadInterval = null;
  function beginUpload(f) {
    state.uploading = true;
    state.uploadFile = f;
    state.uploadProgress = 0;
    state.uploadDone = false;
    state.uploadEventFired = false;

    const modal = $('#upload-modal');
    modal.classList.add('open');
    $('#up-filename').textContent = f.name;
    renderUpload();

    clearInterval(uploadInterval);
    uploadInterval = setInterval(stepUpload, 220);
  }

  function stepUpload() {
    if (!state.uploading) { clearInterval(uploadInterval); return; }
    if (state.time <= 0) { clearInterval(uploadInterval); return; } // 타이머가 처리

    // 네트워크 상태에 따라 속도 변동
    const base = state.net === 'off' ? 1.5 : state.net === 'weak' ? 4 : 9;
    let inc = rnd(base * 0.4, base);

    // 99% 근처에서 자주 멈칫 + 랜덤 업로드 사건
    if (state.uploadProgress >= 92 && state.uploadProgress < 99) inc = rnd(0.3, 2);

    state.uploadProgress = Math.min(100, state.uploadProgress + inc);

    // 업로드 중 랜덤 사건 (한 번)
    if (!state.uploadEventFired && state.uploadProgress > 55 && Math.random() < 0.28) {
      state.uploadEventFired = true;
      const lowMental = state.mental < 40 ? 0.6 : 0.35;
      if (Math.random() < lowMental) {
        clearInterval(uploadInterval);
        const ue = pick(D.UPLOAD_EVENTS);
        SFX.error(); shake();
        openModalThen(ue, () => {
          renderUpload();
          if (!state.uploadDone && state.uploading) {
            uploadInterval = setInterval(stepUpload, 220);
          } else if (state.uploadDone) {
            finishUpload();
          }
        });
        return;
      }
    }

    renderUpload();

    if (state.uploadProgress >= 100 || state.uploadDone) {
      state.uploadProgress = 100;
      renderUpload();
      clearInterval(uploadInterval);
      setTimeout(finishUpload, 350);
    }
  }

  function renderUpload() {
    const pct = Math.floor(state.uploadProgress);
    $('#up-bar').style.width = pct + '%';
    $('#up-pct').textContent = pct + '%';
    $('#up-bar').classList.toggle('jitter', pct >= 92 && pct < 100);
    const msg = pct >= 100 ? '업로드 완료!' :
      pct >= 99 ? '99%... 조금만 더...' :
      pct >= 92 ? '거의 다 왔습니다 (진행 바가 떨립니다)' :
      state.net === 'off' ? '연결이 끊겨 전송이 지연됩니다' :
      state.net === 'weak' ? '불안정한 연결로 느립니다' : '업로드 중...';
    $('#up-status').textContent = msg;
  }

  function cancelUpload() {
    clearInterval(uploadInterval);
    state.uploading = false;
    state.uploadProgress = 0;
    $('#upload-modal').classList.remove('open');
    SFX.click();
    state.log('업로드를 취소했다. 다시 파일을 고를 수 있다.');
  }

  function finishUpload() {
    clearInterval(uploadInterval);
    $('#upload-modal').classList.remove('open');
    if (state.time <= 0) { endGame({ timeout: true }); return; }
    state.uploading = false;
    state.submitted = true;
    state.submittedFile = state.uploadFile;
    state.timeAtSubmit = state.time;
    SFX.uploadDone();
    endGame({ timeout: false });
  }

  /* ------------------------- "메일로 우기기" 버튼 ---------------------- */
  function onInsist() {
    if (!state.running || state.uploading || state.modalOpen) return;
    SFX.click();
    // openModalThen: 어떤 선택을 하든 끝나면 콜백 실행 → 우기기 플래그면 종료
    openModalThen({
      title: '교수님께 "메일로 보냈다"고 우기시겠습니까?',
      body: '실제로 보낸 적은 없습니다. 하지만 자신감만 있다면...',
      choices: [
        { label: '우긴다 (게임 종료)', effect: (s) => { s.flags.insistedEmail = true; } },
        { label: '아니, 정신 차린다', effect: () => {} },
      ],
    }, () => {
      if (state.flags.insistedEmail && state.running) endGame({ timeout: false });
    });
  }

  /* ------------------------------ 엔딩 판정 --------------------------- */
  function endGame({ timeout }) {
    if (!state.running) return;
    state.running = false;
    clearInterval(timerId);
    clearInterval(uploadInterval);
    cancelAnimationFrame(rafId);
    $('#upload-modal').classList.remove('open');
    closeModal();
    document.body.classList.remove('danger', 'critical');

    const ctx = {
      state,
      submitted: state.submitted,
      submittedFile: state.submittedFile,
      timeout: !!timeout,
    };
    const sorted = [...D.ENDINGS].sort((a, b) => b.priority - a.priority);
    const ending = sorted.find(e => {
      try { return e.cond(ctx); } catch (_) { return false; }
    }) || sorted[sorted.length - 1];

    // 레벨 클리어 = 진짜 파일 제출 성공
    const cleared = !!(state.submitted && state.submittedFile && state.submittedFile.isCorrect);
    state.cleared = cleared;

    if (cleared) { SFX.success(); unlockNext(state.level); }
    else SFX.fail();

    showEnding(ending, cleared);
    saveRecord(ending, cleared);
  }

  function showEnding(ending, cleared) {
    const f = state.submittedFile;
    const isLast = currentLevelIdx >= D.LEVELS.length - 1;

    $('#end-emoji').textContent = cleared && isLast ? '🏆' : ending.emoji;
    $('#end-title').textContent = ending.title;
    $('#end-desc').textContent = ending.desc;

    // 클리어 배너
    const banner = $('#end-banner');
    if (cleared) {
      banner.className = 'end-banner ok';
      banner.textContent = isLast
        ? `🏆 Lv.${state.level} 클리어! 모든 레벨을 정복했습니다!`
        : `✅ Lv.${state.level} 「${state.levelName}」 클리어! 다음 레벨이 열렸습니다.`;
    } else {
      banner.className = 'end-banner fail';
      banner.textContent = `❌ Lv.${state.level} 「${state.levelName}」 미클리어 — 진짜 파일 제출에 실패했습니다.`;
    }

    const submitTimeStr = state.timeAtSubmit != null
      ? `마감 ${fmtTime(state.timeAtSubmit)} 전`
      : '제출 못 함';

    const rows = [
      ['레벨', `Lv.${state.level} · ${state.levelName}`],
      ['최종 제출 파일', f ? f.name : '— (미제출)'],
      ['제출 시각', submitTimeStr],
      ['과목 / 과제', `${state.course} / ${state.task}`],
      ['파일 완성도', state.completeness + ' / 100'],
      ['팀원 신뢰도', state.teamTrust + ' / 100'],
      ['교수님 의심도', state.profSuspicion + ' / 100'],
      ['남은 멘탈', state.mental + ' / 100'],
    ];
    $('#end-stats').innerHTML = rows.map(([k, v]) =>
      `<div class="info-row"><span>${k}</span><b>${escapeHtml(String(v))}</b></div>`).join('');

    // 버튼: 클리어 & 다음 레벨 있으면 "다음 레벨", 아니면 상황별
    const nextBtn = $('#btn-next');
    const retryBtn = $('#btn-restart');
    if (cleared && !isLast) {
      nextBtn.style.display = '';
      nextBtn.textContent = `▶ 다음 레벨 (Lv.${state.level + 1})`;
      retryBtn.textContent = '↻ 이 레벨 다시';
    } else if (cleared && isLast) {
      nextBtn.style.display = 'none';
      retryBtn.textContent = '🔄 처음부터 다시';
    } else {
      nextBtn.style.display = 'none';
      retryBtn.textContent = '↻ 이 레벨 다시 도전';
    }

    state.lastEnding = ending;
    show('ending-screen');
  }

  /* --------- 다음 레벨로 진행 / 레벨 재도전 (엔딩 화면 버튼) ----------- */
  function goNextLevel() {
    const isLast = currentLevelIdx >= D.LEVELS.length - 1;
    if (state.cleared && !isLast) startGame(currentLevelIdx + 1);
    else startGame(0);            // 전부 클리어 시 처음부터
  }
  function retryLevel() {
    const isLast = currentLevelIdx >= D.LEVELS.length - 1;
    if (state.cleared && isLast) startGame(0);   // 올클리어 후 처음부터
    else startGame(currentLevelIdx);             // 같은 레벨 재시작
  }

  /* ------------------------- 결과 공유 (클립보드) --------------------- */
  function copyResult() {
    const e = state.lastEnding;
    const f = state.submittedFile;
    const text =
`[과제 제출 1초 전]
나는 '${e.title}' 엔딩을 달성했다. ${e.emoji}
· 과목: ${state.course} / ${state.task}
· 제출 파일: ${f ? f.name : '미제출'}
· 완성도 ${state.completeness} · 팀원신뢰 ${state.teamTrust} · 교수의심 ${state.profSuspicion}
너도 진짜 최종 파일 찾을 수 있어?`;
    navigator.clipboard?.writeText(text).then(() => {
      const btn = $('#btn-copy');
      const old = btn.textContent;
      btn.textContent = '✅ 복사됨!';
      setTimeout(() => btn.textContent = old, 1500);
    }).catch(() => {
      // 클립보드 실패 시 텍스트 영역으로 대체
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();
      $('#btn-copy').textContent = '✅ 복사됨!';
    });
    SFX.click();
  }

  /* --------------------------- 기록 저장 (localStorage) --------------- */
  const LS_KEY = 'deadline1sec.records.v1';
  const LS_LEVEL = 'deadline1sec.maxLevel.v1';   // 열린 최고 레벨(1-based)

  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch (_) { return []; }
  }
  function getMaxLevel() {
    const v = parseInt(localStorage.getItem(LS_LEVEL), 10);
    return (v >= 1 && v <= D.LEVELS.length) ? v : 1;
  }
  function unlockNext(clearedLevelId) {
    const next = Math.min(clearedLevelId + 1, D.LEVELS.length);
    if (next > getMaxLevel()) localStorage.setItem(LS_LEVEL, String(next));
  }
  function saveRecord(ending, cleared) {
    const recs = loadRecords();
    recs.unshift({
      ending: ending.title,
      emoji: ending.emoji,
      level: state.level,
      cleared: !!cleared,
      completeness: state.completeness,
      timeLeft: state.timeAtSubmit,
      when: new Date().toLocaleString('ko-KR'),
    });
    localStorage.setItem(LS_KEY, JSON.stringify(recs.slice(0, 50)));
    renderRecords();
  }
  function renderRecords() {
    const recs = loadRecords();
    const box = $('#records');
    if (!box) return;
    const uniq = new Set(recs.map(r => r.ending));
    const maxLv = getMaxLevel();
    $('#rec-count').textContent =
      `열린 레벨 ${maxLv} / ${D.LEVELS.length} · 엔딩 도감 ${uniq.size} / ${D.ENDINGS.length}종 · 플레이 ${recs.length}회`;
    box.innerHTML = recs.slice(0, 6).map(r =>
      `<li><span>${r.cleared ? '✅' : r.emoji} <b>Lv.${r.level || 1}</b> ${escapeHtml(r.ending)}</span><small>${escapeHtml(r.when)}</small></li>`).join('')
      || '<li class="muted">아직 기록이 없습니다. Lv.1부터 도전해 보세요.</li>';
  }

  /* --------------------------- 레벨 선택 버튼 ------------------------- */
  function renderLevelSelect() {
    const box = $('#level-select');
    if (!box) return;
    const maxLv = getMaxLevel();
    box.innerHTML = D.LEVELS.map((lv, i) => {
      const locked = lv.id > maxLv;
      return `<button class="lv-btn${locked ? ' locked' : ''}" data-idx="${i}" ${locked ? 'disabled' : ''}
        title="${escapeHtml(lv.tip)}">
        <span class="lv-no">Lv.${lv.id}${locked ? ' 🔒' : ''}</span>
        <span class="lv-name">${escapeHtml(lv.name)}</span>
        <span class="lv-meta">⏱ ${fmtTime(lv.time)} · 파일 ${lv.files[0]}~${lv.files[1]}</span>
      </button>`;
    }).join('');
    $$('.lv-btn', box).forEach(btn => {
      btn.addEventListener('click', () => { SFX.click(); startGame(+btn.dataset.idx); });
    });
  }

  /* ----------------------------- 토스트 ------------------------------ */
  let toastTimer = null;
  function toast(title, sub) {
    const el = $('#toast');
    if (!el) return;
    el.innerHTML = `<b>${escapeHtml(title)}</b>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ------------------------------ 유틸 -------------------------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function shake() {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 420);
  }

  /* ---------------------- 시작화면 배경 플로팅 ------------------------ */
  function startBgFloat() {
    const bg = $('#bg-float');
    if (!bg) return;
    const names = ['최종.pdf', '진짜최종.pdf', '진짜최종수정.pdf', '최종최종_이거임.pdf',
      '발표자료_복구본_2.pptx', '교수님보내지마세요.pdf', '최종본_이걸로제출.pptx.pdf',
      '새 폴더 (3)', '절대열지마세요.zip', '보고서_v9_찐막.pdf'];
    bg.innerHTML = names.map((n, i) =>
      `<span class="bg-file" style="left:${rnd(2, 88)}%;top:${rnd(4, 86)}%;
        animation-duration:${rnd(9, 18).toFixed(1)}s;animation-delay:${(-rnd(0, 10)).toFixed(1)}s">${escapeHtml(n)}</span>`
    ).join('');
  }

  /* ------------------------------ 바인딩 ------------------------------ */
  function startFromMax() { startGame(getMaxLevel() - 1); }  // 열린 최고 레벨부터

  function bind() {
    $('#btn-start').addEventListener('click', startFromMax);
    $('#btn-submit').addEventListener('click', onSubmitClick);
    $('#btn-insist').addEventListener('click', onInsist);
    $('#btn-restart').addEventListener('click', retryLevel);
    $('#btn-next').addEventListener('click', goNextLevel);
    $('#btn-copy').addEventListener('click', copyResult);
    $('#btn-menu').addEventListener('click', () => { location.reload(); });
    $('#btn-cancel-upload').addEventListener('click', cancelUpload);
    $('#btn-mute').addEventListener('click', () => {
      const m = SFX.toggleMute();
      $('#btn-mute').textContent = m ? '🔇' : '🔊';
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && $('#start-screen').classList.contains('active')) startFromMax();
    });

    // 시작 버튼 문구를 열린 최고 레벨에 맞춰 표시
    const maxLv = getMaxLevel();
    $('#btn-start').textContent = maxLv > 1
      ? `▶ 이어서 도전 (Lv.${maxLv})` : '▶ 제출 시작 (Lv.1)';

    renderLevelSelect();
    renderRecords();
    startBgFloat();
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
