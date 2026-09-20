(function(){
  let extractedText = '';
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const fileStatus = document.getElementById('file-status');
  const resetBtn = document.getElementById('reset-btn');

  const keywordList = document.getElementById('keyword-list');
  const addKeywordBtn = document.getElementById('add-keyword-btn');
  const kwCurrentCount = document.getElementById('kw-current-count');
  const MAX_KEYWORDS = 20;
  const DEFAULT_KEYWORDS = 6;
  const ADD_STEP = 2;
  let ridCounter = 0;   // 추출위치(행)마다 붙는 고유 번호. 결과는 단어 글자가 아니라 이 번호로 구분한다.

  /* ---------- 단어 + 단어별 추출방식 행 (기본 6개, 2개씩 추가, 최대 20개) ---------- */
  function makeKeywordRow(defaults){
    const d = defaults || {
      word: false, line: false, nextline: false, table: false,
      wordOffset: 1, wordCount: 1, nextlineOffset: 1, nextlineCount: 1, tableOffset: 1, tableCount: 1
    };
    const row = document.createElement('div');
    row.className = 'keyword-row';
    row.dataset.rid = String(++ridCounter);
    row.innerHTML = `
      <span class="kw-index">1</span>
      <input type="text" class="keyword-input" placeholder="예: 이름" value="${escapeHtml(d.keyword || '')}">
      <div class="kw-right">
        <div class="kw-modes">
          <label><input type="checkbox" class="kw-mode-word" ${d.word ? 'checked' : ''}> 뒤단어
            <input type="number" class="kw-count-input kw-offset-word" min="1" max="20" value="${d.wordOffset || 1}">째
            <input type="number" class="kw-count-input kw-count-word" min="1" max="20" value="${d.wordCount || 1}">개
          </label>
          <label><input type="checkbox" class="kw-mode-line" ${d.line ? 'checked' : ''}> 해당줄</label>
          <label><input type="checkbox" class="kw-mode-nextline" ${d.nextline ? 'checked' : ''}> 다음줄
            <input type="number" class="kw-count-input kw-offset-nextline" min="1" max="20" value="${d.nextlineOffset || 1}">째
            <input type="number" class="kw-count-input kw-count-nextline" min="1" max="20" value="${d.nextlineCount || 1}">줄
          </label>
          <label class="kw-table-label"><input type="checkbox" class="kw-mode-table" ${d.table ? 'checked' : ''}> 표
            <select class="kw-table-direction">
              <option value="right" ${(d.tableDirection || 'right') === 'right' ? 'selected' : ''}>오른쪽칸</option>
              <option value="left" ${d.tableDirection === 'left' ? 'selected' : ''}>왼쪽칸</option>
              <option value="up" ${d.tableDirection === 'up' ? 'selected' : ''}>위칸</option>
              <option value="down" ${d.tableDirection === 'down' ? 'selected' : ''}>아래칸</option>
            </select>
            <input type="number" class="kw-count-input kw-offset-table" min="1" max="20" value="${d.tableOffset || 1}">째
            <input type="number" class="kw-count-input kw-count-table" min="1" max="20" value="${d.tableCount || 1}">칸
            (<input type="text" class="kw-table-stopword" placeholder="단어" value="${escapeHtml(d.tableStopWord || '')}">) 단어 앞까지
          </label>
          <label class="kw-split-label" title="표에서 여러 칸을 가져올 때 한 칸에 이어 붙이지 않고, 칸마다 별도의 열로 나눕니다 (예: 아래 1칸 → 열1, 아래 2칸 → 열2). 쪽 단위로 행 맞추기가 켜져 있을 때 적용됩니다."><input type="checkbox" class="kw-table-split" ${d.tableSplit ? 'checked' : ''}> 칸별 열로 나누기</label>
          <label class="kw-cont-label" style="display:none" title="위쪽 추출위치에 같은 단어가 있을 때만 나타납니다. 체크하면 위쪽 행이 잡은 위치의 '다음' 등장분(같은 표, 또는 같은 쪽 안)을 이 행이 가져옵니다. 체크하지 않으면 이 행도 처음부터 다시 찾습니다."><input type="checkbox" class="kw-cont" ${d.cont ? 'checked' : ''}> 같은 표(쪽)에서 이어서 찾기</label>
        </div>
        <div class="kw-actions">
          <button type="button" class="row-run-btn" title="이 단어만 지금 바로 추출합니다">추출하기</button>
          <input type="text" class="kw-exclude-input" placeholder="제외할 값" title="여기 입력한 값을 포함하는 추출 결과는 이 단어의 추출 결과에서 제거합니다 (쉼표로 여러 개 구분)" value="${escapeHtml(d.excludeValue || '')}">
          <button type="button" class="exclude-apply-btn" title="입력한 제외 값을 지금 바로 추출 결과에 적용합니다">제외값 반영</button>
          <button type="button" class="remove-kw" title="삭제">×</button>
        </div>
      </div>
    `;
    const kwInput = row.querySelector('.keyword-input');
    kwInput.addEventListener('input', updateContOptions);

    row.querySelector('.row-run-btn').addEventListener('click', () => {
      const runBtnEl = row.querySelector('.row-run-btn');
      const rowData = getRowData(row);
      if (!extractedText.trim()) { flashRunButton(runBtnEl, '파일 먼저 업로드'); return; }
      if (!rowData.keyword) { flashRunButton(runBtnEl, '단어를 입력하세요'); return; }
      if (!rowData.word && !rowData.line && !rowData.nextline && !rowData.table) { flashRunButton(runBtnEl, '방식을 선택하세요'); return; }
      extractForKeywordRow(rowData, computeOccPlan().get(rowData.rid));
      updateDownloadEnabled();
      updateContOptions();

      // 이 행(추출위치)의 탭으로 바로 전환해서 결과를 보여준다.
      const posIdx = row.querySelector('.kw-index').textContent;
      switchToTab('kw-' + posIdx);

      const cnt = countResultsForRid(rowData.rid);
      flashRunButton(runBtnEl, cnt > 0 ? `${cnt}건 추출됨` : '결과 없음');
      document.querySelector('.preview-panel-full').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    row.querySelector('.exclude-apply-btn').addEventListener('click', () => {
      const btn = row.querySelector('.exclude-apply-btn');
      const kw = kwInput.value.trim();
      if (!kw) { flashExcludeButton(btn, '단어를 입력하세요'); return; }
      const excludeTerms = row.querySelector('.kw-exclude-input').value
        .split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (excludeTerms.length === 0) { flashExcludeButton(btn, '제외할 값을 입력하세요'); return; }
      const removedCount = applyExcludeToRid(row.dataset.rid, excludeTerms);
      updateDownloadEnabled();
      updateContOptions();
      const posIdx = row.querySelector('.kw-index').textContent;
      if (activeTab === 'kw-' + posIdx) renderKeywordPreview(activeTab);
      updateCount();
      flashExcludeButton(btn, removedCount > 0 ? `${removedCount}건 제외됨` : '해당 값 없음');
    });

    row.querySelector('.remove-kw').addEventListener('click', () => {
      if (keywordList.children.length > 1) { const rid = row.dataset.rid; row.remove(); dropRid(rid); updateKeywordCount(); renumberKeywordRows(); updateContOptions(); }
    });
    return row;
  }

  function flashRunButton(btn, message){
    btn.textContent = message;
    setTimeout(() => { btn.textContent = '추출하기'; }, 1400);
  }

  function flashExcludeButton(btn, message){
    btn.textContent = message;
    setTimeout(() => { btn.textContent = '제외값 반영'; }, 1400);
  }

  // 특정 추출위치(rid)의 현재 추출 결과 중, excludeTerms 중 하나라도 값에 포함된 항목을 실제로 제거한다.
  // 반환값은 제거된 건수.
  function applyExcludeToRid(rid, excludeTerms){
    const before = countResultsForRid(rid);
    const matches = (v) => excludeTerms.some(t => String(v).includes(t));
    wordResults = wordResults.filter(r => r.rid !== rid || !matches(r.next));
    lineResults = lineResults.filter(r => r.rid !== rid || !matches(r.line));
    nextLineResults = nextLineResults.filter(r => r.rid !== rid || !matches(r.nextLine));
    tableResults = tableResults.filter(r => r.rid !== rid || !matches(r.next));
    return before - countResultsForRid(rid);
  }

  function clearResultsForRid(rid){
    wordResults = wordResults.filter(r => r.rid !== rid);
    lineResults = lineResults.filter(r => r.rid !== rid);
    nextLineResults = nextLineResults.filter(r => r.rid !== rid);
    tableResults = tableResults.filter(r => r.rid !== rid);
  }

  // 행을 삭제했을 때 그 행의 추출 결과도 함께 지운다.
  function dropRid(rid){
    clearResultsForRid(rid);
    updateDownloadEnabled();
  }

  function getCount(inputEl){
    const n = parseInt(inputEl.value, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, 20);
  }

  function renumberKeywordRows(){
    [...keywordList.children].forEach((row, i) => {
      const idx = row.querySelector('.kw-index');
      if (idx) idx.textContent = i + 1;
    });
    renderKeywordTabs();
  }

  function updateKeywordCount(){
    const n = keywordList.children.length;
    if (kwCurrentCount) kwCurrentCount.textContent = n;
    addKeywordBtn.disabled = n >= MAX_KEYWORDS;
  }

  addKeywordBtn.addEventListener('click', () => {
    const toAdd = Math.min(ADD_STEP, MAX_KEYWORDS - keywordList.children.length);
    if (toAdd <= 0) return;
    let firstNewRow = null;
    for (let i = 0; i < toAdd; i++) {
      const row = makeKeywordRow();
      keywordList.appendChild(row);
      if (!firstNewRow) firstNewRow = row;
    }
    updateKeywordCount();
    renumberKeywordRows();
    updateContOptions();
    if (firstNewRow) firstNewRow.querySelector('input').focus();
  });

  const runBtn = document.getElementById('run-btn');
  const downloadBtn = document.getElementById('download-btn');
  const statusEl = document.getElementById('status');
  const resultCount = document.getElementById('result-count');

  const tabs = document.getElementById('tabs');
  const kwPreviewView = document.getElementById('kw-preview-view');
  const aggView = document.getElementById('agg-view');
  const aggEmpty = document.getElementById('agg-empty');
  const aggTableWrap = document.getElementById('agg-table-wrap');

  let wordResults = [];
  let lineResults = [];
  let nextLineResults = [];
  let tableResults = [];
  let aggRows = [];
  let aggSource = null;
  let aggFormat = 'wide';
  let lastSources = [];   // [{ rid, keyword }] 마지막 병합에 쓴 추출위치들
  let lastModeFlags = { word: false, line: false, nextline: false, table: false };
  let hwpxTables = null;
  let currentFileType = null; // 'hwpx' | 'pdf' | null
  // [쪽 번호 색인] 결과마다 "몇 쪽에서 찾았는지"를 함께 기록해서, 같은 쪽의 값끼리 한 행으로 맞춘다.
  let linePages = [];          // linePages[i] = (i+1)번째 줄이 속한 쪽 번호(1부터)
  let hwpxTableMeta = null;    // hwpxTables와 같은 순서: [{ page, rowLines: [행마다 문서 전체 기준 줄 번호] }]
  let pagesDetected = false;   // 쪽 번호를 얻을 수 있었는지 (PDF는 항상, HWPX는 문서에 배치 정보가 있을 때)
  const pageModeEl = document.getElementById('page-mode');
  function pageMode(){ return !pageModeEl || pageModeEl.checked; }
  const dupModeEl = document.getElementById('dup-mode');
  function dupMode(){ return dupModeEl && dupModeEl.value === 'rows' ? 'rows' : 'cols'; }
  let lastMergeNote = '';   // 병합 결과에 대한 안내 문구(열이 많이 펼쳐졌을 때 등)
  function pageOfLine(lineNo){ return pagesDetected ? (linePages[lineNo - 1] || 1) : 1; }
  let activeTab = 'kw-1';

  for (let i = 0; i < DEFAULT_KEYWORDS; i++) keywordList.appendChild(makeKeywordRow());
  updateKeywordCount();
  renumberKeywordRows();
  updateContOptions();
  switchToTab('kw-1');

  // 한 행(DOM)에서 키워드, 선택된 추출 방식, 번째/개수 설정을 읽어온다.
  function getRowData(rowEl){
    return {
      rid: rowEl.dataset.rid,
      keyword: rowEl.querySelector('.keyword-input').value.trim(),
      word: rowEl.querySelector('.kw-mode-word').checked,
      line: rowEl.querySelector('.kw-mode-line').checked,
      nextline: rowEl.querySelector('.kw-mode-nextline').checked,
      table: rowEl.querySelector('.kw-mode-table').checked,
      wordOffset: getCount(rowEl.querySelector('.kw-offset-word')),
      wordCount: getCount(rowEl.querySelector('.kw-count-word')),
      nextlineOffset: getCount(rowEl.querySelector('.kw-offset-nextline')),
      nextlineCount: getCount(rowEl.querySelector('.kw-count-nextline')),
      tableDirection: rowEl.querySelector('.kw-table-direction').value,
      tableOffset: getCount(rowEl.querySelector('.kw-offset-table')),
      tableCount: getCount(rowEl.querySelector('.kw-count-table')),
      tableStopWord: rowEl.querySelector('.kw-table-stopword').value.trim(),
      tableSplit: rowEl.querySelector('.kw-table-split').checked,
      cont: rowEl.querySelector('.kw-cont').checked,
      excludeValue: rowEl.querySelector('.kw-exclude-input').value.trim(),
    };
  }

  // 단어가 입력된 모든 행을 그대로(합치지 않고) 순서대로 돌려준다.
  // 같은 단어가 여러 행에 있으면 행마다 따로 추출되고 병합에서도 각각 별도의 열이 된다.
  function getKeywordRows(){
    const out = [];
    keywordList.querySelectorAll('.keyword-row').forEach(rowEl => {
      const d = getRowData(rowEl);
      if (d.keyword) out.push(d);
    });
    return out;
  }

  // "같은 표(쪽)에서 이어서 찾기" 계획: 같은 단어가 위쪽 행에 있고 이 행에 체크가 되어 있으면,
  // 위쪽 행이 가져간 등장분의 다음 것(1번째, 2번째, …)을 이 행이 가져가도록 몇 번째인지(occ)를 정한다.
  // 이어지는 체인의 맨 앞 행은 자동으로 "첫 번째 등장분만" 가져간다. 체인에 속하지 않은 행은 null(= 모든 등장분).
  function computeOccPlan(){
    const plan = new Map();
    const last = new Map();   // 단어 -> 직전에 나온 같은 단어 행의 rid
    keywordList.querySelectorAll('.keyword-row').forEach(rowEl => {
      const kw = rowEl.querySelector('.keyword-input').value.trim();
      if (!kw) return;
      const rid = rowEl.dataset.rid;
      const cont = rowEl.querySelector('.kw-cont').checked;
      if (cont && last.has(kw)) {
        const prevRid = last.get(kw);
        if (plan.get(prevRid) == null) plan.set(prevRid, 0);
        plan.set(rid, plan.get(prevRid) + 1);
      } else {
        plan.set(rid, null);
      }
      last.set(kw, rid);
    });
    return plan;
  }

  // 같은 단어가 위쪽 행에 이미 있는 행에만 "이어서 찾기" 체크박스를 보여준다.
  function updateContOptions(){
    const seen = new Set();
    keywordList.querySelectorAll('.keyword-row').forEach(row => {
      const kw = row.querySelector('.keyword-input').value.trim();
      const lab = row.querySelector('.kw-cont-label');
      if (lab) lab.style.display = (kw && seen.has(kw)) ? '' : 'none';
      if (kw) seen.add(kw);
    });
  }

  // 열 이름: 같은 단어의 첫 행은 단어 그대로, 두 번째 행부터는 "단어 (위치N)"으로 구분한다.
  function sourceLabelMap(){
    const map = new Map();
    const seen = new Set();
    keywordList.querySelectorAll('.keyword-row').forEach((row, i) => {
      const kw = row.querySelector('.keyword-input').value.trim();
      if (!kw) return;
      map.set(row.dataset.rid, seen.has(kw) ? `${kw} (위치${i + 1})` : kw);
      seen.add(kw);
    });
    return map;
  }

  /* ---------- 통합 결과 형식 토글 ---------- */
  document.querySelectorAll('input[name="agg-format"]').forEach(radio => {
    radio.addEventListener('change', () => {
      aggFormat = document.querySelector('input[name="agg-format"]:checked').value;
      renderAggTable(lastSources);
      if (activeTab === 'agg') updateCount();
    });
  });

  function syncDupModeState(){ if (dupModeEl) dupModeEl.disabled = !pageMode(); }
  if (pageModeEl) {
    pageModeEl.addEventListener('change', () => {
      syncDupModeState();
      renderAggTable(lastSources);
      if (activeTab === 'agg') updateCount();
    });
  }
  if (dupModeEl) {
    dupModeEl.addEventListener('change', () => {
      renderAggTable(lastSources);
      if (activeTab === 'agg') updateCount();
    });
  }

  /* ---------- 파일 업로드 / 드래그앤드롭 (.hwpx / .pdf) ---------- */
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('highlight'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('highlight'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('highlight');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  // pdf.js workerSrc는 위 <script type="module"> 블록에서 5.4.530 기준으로 이미 설정됨

  async function extractPdfText(file){
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const lines = [];
    const pageOfLineArr = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const rowGroups = []; // [{y, items:[{x,str}]}]
      content.items.forEach(it => {
        const y = Math.round(it.transform[5]);
        const x = it.transform[4];
        let group = rowGroups.find(g => Math.abs(g.y - y) <= 2);
        if (!group) { group = { y, items: [] }; rowGroups.push(group); }
        group.items.push({ x, str: it.str });
      });
      rowGroups.sort((a, b) => b.y - a.y);
      rowGroups.forEach(g => {
        const text = g.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
        if (text) { lines.push(text); pageOfLineArr.push(p); }
      });
    }
    if (lines.length === 0) {
      throw new Error('텍스트를 찾을 수 없습니다. 스캔본(이미지) PDF는 지원되지 않습니다.');
    }
    return { text: lines.join('\n'), linePages: pageOfLineArr, pageCount: pdf.numPages };
  }

  async function handleFile(file){
    statusEl.textContent = '';
    const name = file.name.toLowerCase();
    const isHwpx = /\.hwpx$/i.test(name);
    const isPdf = /\.pdf$/i.test(name);

    if (!isHwpx && !isPdf) {
      fileStatus.textContent = '.hwpx, .pdf 파일만 업로드할 수 있습니다.';
      return;
    }

    const MAX_FILE_MB = 50;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      fileStatus.textContent = `파일이 너무 큽니다 (${MAX_FILE_MB}MB 이하만 지원). 브라우저가 느려지거나 멈출 수 있어 제한합니다.`;
      return;
    }

    runBtn.disabled = true;
    hwpxTables = null;
    hwpxTableMeta = null;
    linePages = [];
    pagesDetected = false;
    currentFileType = null;

    try {
      if (isHwpx) {
        fileStatus.textContent = `"${file.name}" 에서 본문과 표를 추출하는 중...`;
        const result = await extractHwpxText(file);
        extractedText = result.text;
        hwpxTables = result.tables;
        hwpxTableMeta = result.tableMeta;
        linePages = result.linePages;
        pagesDetected = result.pagesDetected;
        currentFileType = 'hwpx';
        const pageNote = result.pagesDetected
          ? `, 쪽 ${result.pageCount}개로 추정`
          : ', 쪽 정보를 찾지 못해 전체를 1쪽으로 처리';
        fileStatus.textContent = `"${file.name}" 불러옴 (표 ${result.tables.length}개 인식됨${pageNote})`;
      } else if (isPdf) {
        fileStatus.textContent = `"${file.name}" 에서 텍스트를 추출하는 중...`;
        const pdfResult = await extractPdfText(file);
        extractedText = pdfResult.text;
        linePages = pdfResult.linePages;
        pagesDetected = true;
        currentFileType = 'pdf';
        fileStatus.textContent = `"${file.name}" 불러옴 (PDF ${pdfResult.pageCount}쪽 · 표 옆칸 추출은 지원되지 않음)`;
      }
    } catch (err) {
      hwpxTables = null;
      hwpxTableMeta = null;
      linePages = [];
      pagesDetected = false;
      extractedText = '';
      currentFileType = null;
      fileStatus.textContent = '파일을 처리하는 중 오류: ' + err.message;
    } finally {
      runBtn.disabled = false;
    }
  }

  /* ---------- 초기화 ---------- */
  resetBtn.addEventListener('click', () => {
    extractedText = '';
    fileInput.value = '';
    hwpxTables = null;
    hwpxTableMeta = null;
    linePages = [];
    pagesDetected = false;
    currentFileType = null;
    fileStatus.textContent = '아직 불러온 파일이 없습니다.';

    keywordList.innerHTML = '';
    for (let i = 0; i < DEFAULT_KEYWORDS; i++) keywordList.appendChild(makeKeywordRow());
    updateKeywordCount();
    renumberKeywordRows();

    document.querySelector('input[name="agg-format"][value="wide"]').checked = true;
    aggFormat = 'wide';
    if (pageModeEl) pageModeEl.checked = true;
    if (dupModeEl) dupModeEl.value = 'cols';
    syncDupModeState();

    wordResults = []; lineResults = []; nextLineResults = []; tableResults = [];
    aggRows = []; aggSource = null; lastSources = [];
    lastModeFlags = { word: false, line: false, nextline: false, table: false };
    updateContOptions();
    renderAggTable([]);
    switchToTab('kw-1');
    downloadBtn.disabled = true;
    statusEl.textContent = '';
  });

  /* ---------- HWPX 파싱 ---------- */
  function closestByTag(node, tagName){
    let cur = node.parentNode;
    while (cur && cur.tagName !== tagName) cur = cur.parentNode;
    return cur;
  }

  // 반환: { rows, rowLines } — rowLines[i]는 i번째 행의 첫 글자가 있는 문단의 "문서 전체 기준 줄 번호".
  // 표 결과와 일반 줄 결과가 같은 좌표(줄 번호)로 순서를 비교할 수 있게 해준다.
  function parseTable(tblNode, paraInfo){
    const rows = [];
    const rowLines = [];
    let lastLine = 0;
    const trNodes = tblNode.getElementsByTagName('hp:tr');
    for (let ri = 0; ri < trNodes.length; ri++) {
      const tr = trNodes[ri];
      if (closestByTag(tr, 'hp:tbl') !== tblNode) continue;

      const tcNodes = tr.getElementsByTagName('hp:tc');
      const cells = [];
      for (let ci = 0; ci < tcNodes.length; ci++) {
        const tc = tcNodes[ci];
        if (closestByTag(tc, 'hp:tr') !== tr) continue;

        const tNodes = tc.getElementsByTagName('hp:t');
        let cellText = '';
        for (let k = 0; k < tNodes.length; k++) {
          if (closestByTag(tNodes[k], 'hp:tc') !== tc) continue;
          cellText += tNodes[k].textContent;
        }
        cells.push(cellText.trim());
      }
      if (cells.length > 0) {
        let lineNo = 0;
        const rowT = tr.getElementsByTagName('hp:t');
        for (let k = 0; k < rowT.length && !lineNo; k++) {
          const p = closestByTag(rowT[k], 'hp:p');
          const info = p && paraInfo.get(p);
          if (info) lineNo = info.lineNo;
        }
        if (!lineNo) lineNo = lastLine;
        lastLine = lineNo || lastLine;
        rows.push(cells);
        rowLines.push(lineNo);
      }
    }
    return { rows, rowLines };
  }

  async function extractHwpxText(file){
    const zip = await JSZip.loadAsync(file);

    // [보안] Zip Bomb 방어: 실제로 압축을 풀기 전에, 각 항목의 헤더에 적힌 "압축 해제 시 용량"을
    // 먼저 합산해서 확인한다. 작게 압축된 파일이 풀렸을 때 수 GB로 부풀어 브라우저가 멈추는 것을 막는다.
    const MAX_UNCOMPRESSED_MB = 200;
    let totalUncompressed = 0;
    Object.keys(zip.files).forEach(name => {
      const entry = zip.files[name];
      const size = (entry && entry._data && typeof entry._data.uncompressedSize === 'number') ? entry._data.uncompressedSize : 0;
      totalUncompressed += size;
    });
    if (totalUncompressed > MAX_UNCOMPRESSED_MB * 1024 * 1024) {
      throw new Error(`압축을 해제하면 예상 용량이 너무 큽니다 (${MAX_UNCOMPRESSED_MB}MB 초과). 손상되었거나 비정상적인 파일일 수 있습니다.`);
    }

    const sectionFiles = Object.keys(zip.files)
      .filter(name => /^Contents\/section\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/section(\d+)/i)[1], 10);
        const nb = parseInt(b.match(/section(\d+)/i)[1], 10);
        return na - nb;
      });

    if (sectionFiles.length === 0) {
      throw new Error('본문(section) 파일을 찾을 수 없습니다. 올바른 HWPX 파일인지 확인해주세요.');
    }

    const lines = [];
    const linePagesOut = [];
    const tables = [];
    const tableMeta = [];

    // [쪽 번호 추정] HWPX 파일에는 "몇 쪽"이라는 값이 직접 들어있지 않다(쪽 나눔은 한글 프로그램이 화면에서
    // 계산한다). 대신 파일에 남아있는 배치 정보로 추정한다.
    //  - 구역(section)이 바뀌면 새 쪽
    //  - 문단의 pageBreak="1" 이면 새 쪽(강제 쪽 나눔)
    //  - 최상위 문단의 줄 위치(lineseg vertpos)가 직전보다 작아지면 새 쪽(쪽 위쪽으로 되돌아간 것)
    // 표 안 문단은 그 표를 담은 최상위 문단의 쪽을 따른다.
    let pageNo = 1;
    let sawLayout = false;  // vertpos나 pageBreak를 하나라도 발견했는지
    let sectionIdx = 0;

    for (const name of sectionFiles) {
      const xmlStr = await zip.files[name].async('string');
      const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
      if (doc.querySelector('parsererror')) {
        throw new Error('본문 XML을 해석할 수 없습니다.');
      }

      if (sectionIdx > 0) pageNo++;
      sectionIdx++;

      // (1) 최상위 문단(다른 문단 안에 들어있지 않은 문단)마다 시작 쪽 번호를 매긴다.
      const topPage = new Map();
      let lastVert = null;
      let firstPara = true;
      const allP = doc.getElementsByTagName('hp:p');
      for (let i = 0; i < allP.length; i++) {
        const p = allP[i];
        if (closestByTag(p, 'hp:p')) continue;

        if (!firstPara && p.getAttribute('pageBreak') === '1') { pageNo++; lastVert = null; sawLayout = true; }
        firstPara = false;

        let pageAtStart = pageNo;
        let firstSeg = true;
        for (let c = p.firstChild; c; c = c.nextSibling) {
          if (c.nodeType !== 1 || c.tagName !== 'hp:linesegarray') continue;
          const segs = c.getElementsByTagName('hp:lineseg');
          for (let s = 0; s < segs.length; s++) {
            const vp = parseInt(segs[s].getAttribute('vertpos'), 10);
            if (!Number.isFinite(vp)) continue;
            sawLayout = true;
            if (lastVert !== null && vp < lastVert) pageNo++;
            if (firstSeg) { pageAtStart = pageNo; firstSeg = false; }
            lastVert = vp;
          }
        }
        topPage.set(p, pageAtStart);
      }

      // (2) 문단 → 줄. 각 줄에 쪽 번호를 붙이고, 문단의 첫 줄 번호를 paraInfo에 기록해둔다.
      const tNodes = doc.getElementsByTagName('hp:t');
      const paraMap = new Map();
      for (let i = 0; i < tNodes.length; i++) {
        const t = tNodes[i];
        const node = closestByTag(t, 'hp:p');
        if (!node) continue;
        if (!paraMap.has(node)) paraMap.set(node, []);
        paraMap.get(node).push(t.textContent);
      }
      const paraInfo = new Map();
      for (const [node, parts] of paraMap) {
        let top = node;
        for (let cur = node.parentNode; cur; cur = cur.parentNode) if (cur.tagName === 'hp:p') top = cur;
        const page = topPage.get(top) || pageNo;
        const startLine = lines.length + 1;
        parts.join('').split(/\r\n|\r|\n/).forEach(seg => { lines.push(seg); linePagesOut.push(page); });
        paraInfo.set(node, { lineNo: startLine, page });
      }

      // (3) 표
      const tblNodes = doc.getElementsByTagName('hp:tbl');
      for (let ti = 0; ti < tblNodes.length; ti++) {
        const parsed = parseTable(tblNodes[ti], paraInfo);
        if (parsed.rows.length === 0) continue;
        let holder = null;
        for (let cur = tblNodes[ti].parentNode; cur; cur = cur.parentNode) if (cur.tagName === 'hp:p') holder = cur;
        tables.push(parsed.rows);
        tableMeta.push({ page: (holder && topPage.get(holder)) || pageNo, rowLines: parsed.rowLines });
      }
    }

    return { text: lines.join('\n'), tables, tableMeta, linePages: linePagesOut, pagesDetected: sawLayout, pageCount: pageNo };
  }

  /* ---------- 탭 전환 (단어 위치별 동적 탭) ---------- */
  function renderKeywordTabs(){
    const rows = [...keywordList.children];
    // 현재 활성 탭이 가리키는 위치가 더 이상 없으면 1번으로 되돌린다.
    if (activeTab.startsWith('kw-')) {
      const idx = parseInt(activeTab.slice(3), 10);
      if (idx > rows.length) activeTab = 'kw-1';
    }
    const kwTabsHtml = rows.map((row, i) => {
      const idx = i + 1;
      const tabId = 'kw-' + idx;
      return `<button data-tab="${tabId}" class="${activeTab === tabId ? 'active' : ''}">추출위치${idx}</button>`;
    }).join('');
    const aggTabHtml = `<button data-tab="agg" class="${activeTab === 'agg' ? 'active' : ''}">통합 결과</button>`;
    tabs.innerHTML = kwTabsHtml + aggTabHtml;
  }

  function switchToTab(tabName){
    activeTab = tabName;
    renderKeywordTabs();
    if (activeTab === 'agg') {
      kwPreviewView.style.display = 'none';
      aggView.style.display = '';
      aggView.classList.remove('hidden'); // [수정] index.html에 처음부터 class="hidden"이 붙어있어서
                                           // style.display만 바꿔서는 CSS의 .hidden 규칙(주로 !important)에
                                           // 가려 화면에 안 보이는 문제가 있었다. 클래스를 직접 제거해준다.
    } else {
      aggView.style.display = 'none';
      aggView.classList.add('hidden');
      kwPreviewView.style.display = '';
      renderKeywordPreview(activeTab);
    }
    updateCount();
  }

  // "추출위치N" 탭 하나의 내용: 그 위치(행)의 현재 단어에 대한 모든 방식의 결과를 한 표로 모아 보여준다.
  function renderKeywordPreview(tabId){
    const idx = parseInt(tabId.slice(3), 10);
    const row = keywordList.children[idx - 1];
    if (!row) { kwPreviewView.innerHTML = `<div class="empty">추출위치${idx}가 없습니다.</div>`; return; }

    const keyword = row.querySelector('.keyword-input').value.trim();
    if (!keyword) {
      kwPreviewView.innerHTML = `<div class="empty">추출위치${idx}에 단어를 입력한 뒤 추출하기를 눌러주세요.</div>`;
      return;
    }

    const rid = row.dataset.rid;
    const rows = [];
    const pg = (r) => pagesDetected ? `${r.page}쪽 · ` : '';
    wordResults.filter(r => r.rid === rid).forEach(r => rows.push({ mode: '뒤 단어', loc: `${pg(r)}${r.lineNo}줄`, value: r.next }));
    lineResults.filter(r => r.rid === rid).forEach(r => rows.push({ mode: '해당 줄', loc: `${pg(r)}${r.lineNo}줄`, value: r.line }));
    nextLineResults.filter(r => r.rid === rid).forEach(r => rows.push({ mode: '다음 줄', loc: `${pg(r)}${r.lineNo}줄`, value: r.nextLine }));
    tableResults.filter(r => r.rid === rid).forEach(r => rows.push({ mode: '표 옆칸', loc: `${pg(r)}표${r.tableNo}-행${r.rowNo}`, value: r.next }));

    if (rows.length === 0) {
      kwPreviewView.innerHTML = `<div class="empty">"${escapeHtml(keyword)}"의 추출 결과가 없습니다. 이 위치의 "추출하기"를 눌러주세요.</div>`;
      return;
    }

    const body = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.mode)}</td>
        <td>${escapeHtml(r.loc)}</td>
        <td><strong>${highlight(r.value, keyword)}</strong></td>
      </tr>
    `).join('');

    kwPreviewView.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th class="col-narrow">번호</th><th>방식</th><th>위치</th><th>값</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    switchToTab(btn.dataset.tab);
  });

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function highlight(text, keyword){
    if (!keyword) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escKw = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(escKw, 'g'), m => `<mark>${m}</mark>`);
  }

  function updateCount(){
    let n = 0;
    if (activeTab === 'agg') n = aggRows.length;
    else {
      const idx = parseInt(activeTab.slice(3), 10);
      const row = keywordList.children[idx - 1];
      const keyword = row ? row.querySelector('.keyword-input').value.trim() : '';
      n = (row && keyword) ? countResultsForRid(row.dataset.rid) : 0;
    }
    resultCount.textContent = n ? `${n}건 발견` : '';
  }

  /* ---------- 추출 실행 ---------- */
  // 한 행(하나의 키워드)에 대해서만 추출을 수행한다. 이 키워드의 기존 결과는 지우고 새로 채운다.
  // 표 옆칸: 검색어가 있는 칸(rIdx행, c열)을 기준으로 지정한 방향(right/left/up/down)으로
  // offset번째 칸부터 count개, 또는 stopWord가 있으면 그 단어가 나오기 전까지 값을 모은다.
  // 결과는 항상 자연스러운 읽기 순서(왼→오, 위→아래)로 반환한다.
  function collectDirectionalCells(rows, cells, rIdx, c, direction, offset, count, stopWord){
    function cellAt(step){
      if (direction === 'right') return cells[c + step];
      if (direction === 'left') return cells[c - step];
      if (direction === 'down') return (rows[rIdx + step] || [])[c];
      if (direction === 'up') return (rows[rIdx - step] || [])[c];
      return undefined;
    }

    const vals = [];
    const stop = (stopWord || '').trim();
    if (stop) {
      const MAX_SAFETY = 50;
      for (let k = 0; k < MAX_SAFETY; k++) {
        const v = cellAt(offset + k);
        if (v === undefined) break;
        if (v.includes(stop)) break;
        vals.push(v);
      }
    } else {
      for (let k = 0; k < count; k++) {
        const v = cellAt(offset + k);
        if (v === undefined) break;
        vals.push(v);
      }
    }

    if (direction === 'left' || direction === 'up') vals.reverse();
    return vals;
  }

  // 같은 묶음(표 또는 쪽) 안에서 occ번째(0부터) 등장분만 남긴다.
  function takeOccurrence(arr, occ){
    const cnt = new Map();
    const out = [];
    arr.forEach(it => {
      const c = cnt.get(it._g) || 0;
      cnt.set(it._g, c + 1);
      if (c === occ) out.push(it);
    });
    return out;
  }

  // occ: null이면 찾은 모든 등장분, 숫자면 같은 표(표 옆칸) / 같은 쪽(그 외 방식) 안에서 occ번째 등장분만.
  function extractForKeywordRow(rowData, occ){
    const keyword = rowData.keyword;
    const rid = rowData.rid;
    clearResultsForRid(rid);

    const wRes = [], lRes = [], nRes = [], tRes = [];
    const lines = extractedText.split(/\r\n|\r|\n/);

    lines.forEach((line, lineIdx) => {
      const lineNo = lineIdx + 1;
      const page = pageOfLine(lineNo);
      const g = 'p' + page;
      const tokens = line.split(/\s+/).filter(t => t.length > 0);

      if (rowData.word) {
        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i] === keyword) {
            const start = i + rowData.wordOffset;
            const nextTokens = tokens.slice(start, start + rowData.wordCount);
            if (nextTokens.length > 0) {
              wRes.push({ rid, lineNo, page, _g: g, keyword, found: tokens[i], next: nextTokens.join(' ') });
            }
          }
        }
      }

      if (rowData.line && line.includes(keyword)) {
        const matchCount = tokens.filter(t => t === keyword).length || (line.split(keyword).length - 1);
        lRes.push({ rid, lineNo, page, _g: g, keyword, matchCount, line });
      }

      if (rowData.nextline && line.includes(keyword)) {
        const matchCount = tokens.filter(t => t === keyword).length || (line.split(keyword).length - 1);
        const start = lineIdx + rowData.nextlineOffset;
        const nextChunk = lines.slice(start, start + rowData.nextlineCount).join('\n');
        if (nextChunk.length > 0) {
          nRes.push({ rid, lineNo, page, _g: g, keyword, matchCount, nextLine: nextChunk });
        }
      }
    });

    if (rowData.table) {
      if (hwpxTables && hwpxTables.length > 0) {
        hwpxTables.forEach((rows, tIdx) => {
          const meta = hwpxTableMeta && hwpxTableMeta[tIdx];
          rows.forEach((cells, rIdx) => {
            for (let c = 0; c < cells.length; c++) {
              if (cells[c].includes(keyword)) {
                const nextCells = collectDirectionalCells(rows, cells, rIdx, c, rowData.tableDirection, rowData.tableOffset, rowData.tableCount, rowData.tableStopWord);
                if (nextCells.length > 0) {
                  tRes.push({
                    rid, tableNo: tIdx + 1, rowNo: rIdx + 1, _g: 't' + tIdx, keyword, found: cells[c],
                    next: nextCells.join(' / '), parts: nextCells, split: !!rowData.tableSplit,
                    page: (pagesDetected && meta) ? meta.page : 1,
                    pos: (meta && meta.rowLines[rIdx]) || (tIdx * 1000 + rIdx + 1)
                  });
                }
              }
            }
          });
        });
      } else {
        statusEl.textContent = (currentFileType && currentFileType !== 'hwpx')
          ? '표 옆칸 추출은 .hwpx 파일에서만 지원됩니다. 다른 추출 방식을 이용해주세요.'
          : '표 구조 정보가 없습니다. .hwpx 파일에 표가 포함되어 있는지 확인해주세요.';
      }
    }

    const pick = (arr) => (occ == null ? arr : takeOccurrence(arr, occ));
    pick(wRes).forEach(x => wordResults.push(x));
    pick(lRes).forEach(x => lineResults.push(x));
    pick(nRes).forEach(x => nextLineResults.push(x));
    pick(tRes).forEach(x => tableResults.push(x));
  }

  function countResultsForRid(rid){
    return wordResults.filter(r => r.rid === rid).length
      + lineResults.filter(r => r.rid === rid).length
      + nextLineResults.filter(r => r.rid === rid).length
      + tableResults.filter(r => r.rid === rid).length;
  }

  // "추출값 병합하기": 입력된 모든 추출위치(행)에 대해 지금 설정된 방식으로 추출을 실행한 뒤,
  // 그 결과들을 모아 통합 결과(자동)를 만든다. 같은 단어가 여러 행에 있으면 행마다 별도의 열이 된다.
  runBtn.addEventListener('click', () => {
    statusEl.textContent = '';
    const kwRows = getKeywordRows();

    if (kwRows.length === 0) { statusEl.textContent = '찾을 단어를 한 개 이상 입력해주세요.'; return; }

    if (!extractedText.trim()) { statusEl.textContent = '파일을 먼저 업로드해주세요.'; return; }

    const plan = computeOccPlan();
    kwRows.forEach(rowData => {
      if (rowData.word || rowData.line || rowData.nextline || rowData.table) {
        extractForKeywordRow(rowData, plan.get(rowData.rid));
        const ex = (rowData.excludeValue || '').split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (ex.length > 0) applyExcludeToRid(rowData.rid, ex);
      } else {
        clearResultsForRid(rowData.rid);
      }
    });

    lastModeFlags = {
      word: kwRows.some(r => r.word),
      line: kwRows.some(r => r.line),
      nextline: kwRows.some(r => r.nextline),
      table: kwRows.some(r => r.table),
    };

    setAggSource();
    lastSources = kwRows.map(r => ({ rid: r.rid, keyword: r.keyword }));

    renderAggTable(lastSources);
    switchToTab('agg');
    updateDownloadEnabled();
    updateContOptions();

    if (wordResults.length === 0 && lineResults.length === 0 && nextLineResults.length === 0 && tableResults.length === 0) {
      statusEl.textContent = '병합할 결과가 없습니다. 각 추출위치에 단어와 추출 방식을 선택했는지 확인해주세요.';
    } else if (!statusEl.textContent) {
      statusEl.textContent = `${lastSources.length}개 추출위치의 결과를 병합했습니다.` + (lastMergeNote ? ' ' + lastMergeNote : '');
    }
  });

  // 통합 결과의 원본: 뒤 단어 / 해당 줄 / 다음 줄 / 표 옆칸 네 가지 결과를 모두 하나의 목록으로 합친다.
  // 모든 항목에는 추출위치(rid), 찾은 쪽(page), 문서 안에서의 순서(pos = 문서 전체 기준 줄 번호)가 붙고,
  // parts는 그 항목이 만들어낼 열 값들이다(대부분 1개, 표의 "칸별 열로 나누기"일 때 여러 개).
  function makeItems(ridFilter){
    const ok = (rid) => ridFilter == null || rid === ridFilter;
    const items = [];
    wordResults.forEach(it => { if (ok(it.rid)) items.push({ idType: 'line', id: [it.lineNo], page: it.page, pos: it.lineNo, rid: it.rid, keyword: it.keyword, value: it.next, parts: [it.next] }); });
    lineResults.forEach(it => { if (ok(it.rid)) items.push({ idType: 'line', id: [it.lineNo], page: it.page, pos: it.lineNo, rid: it.rid, keyword: it.keyword, value: it.line, parts: [it.line] }); });
    nextLineResults.forEach(it => { if (ok(it.rid)) items.push({ idType: 'line', id: [it.lineNo], page: it.page, pos: it.lineNo, rid: it.rid, keyword: it.keyword, value: it.nextLine, parts: [it.nextLine] }); });
    tableResults.forEach(it => { if (ok(it.rid)) items.push({ idType: 'table', id: [it.tableNo, it.rowNo], page: it.page, pos: it.pos, rid: it.rid, keyword: it.keyword, value: it.next, parts: (it.split && it.parts) ? it.parts : [it.next] }); });
    return items;
  }

  function setAggSource(){
    const items = makeItems(null);
    aggSource = items.length > 0 ? { items } : null;
  }

  function getResultItemsForRid(rid){
    return makeItems(rid);
  }

  // matrix[행][열(sources 순서)] = 그 칸에 들어갈 항목 배열(보통 0~1개, 같은 쪽·표에서 여러 번 찾았으면 여러 개).
  // 여러 개면 옆 열로 펼치고("단어 (2)"), 표 값이 여러 칸이면 "단어 [칸2]"처럼 열을 더 만든다.
  function layoutMatrix(sources, matrix, pages){
    lastMergeNote = '';
    const labels = sourceLabelMap();
    const hitsW = sources.map((s, si) => matrix.reduce((m, r) => Math.max(m, r[si].length), 1));
    const partsW = sources.map((s, si) => {
      let m = 1;
      matrix.forEach(r => r[si].forEach(it => { m = Math.max(m, it.parts.length); }));
      return m;
    });
    const headers = [];
    sources.forEach((s, si) => {
      const base = labels.get(s.rid) || s.keyword;
      for (let j = 0; j < hitsW[si]; j++) {
        for (let p = 0; p < partsW[si]; p++) {
          headers.push(base + (j ? ` (${j + 1})` : '') + (p ? ` [칸${p + 1}]` : ''));
        }
      }
    });
    const dataRows = matrix.map(r => {
      const row = [];
      sources.forEach((s, si) => {
        for (let j = 0; j < hitsW[si]; j++) {
          for (let p = 0; p < partsW[si]; p++) {
            const it = r[si][j];
            row.push(it && it.parts[p] !== undefined ? it.parts[p] : '');
          }
        }
      });
      return row;
    });
    const wide = sources.map((s, si) => ({ s, n: hitsW[si] })).filter(x => x.n >= 6);
    if (wide.length > 0) {
      const nm = labels.get(wide[0].s.rid) || wide[0].s.keyword;
      lastMergeNote = `"${nm}"이(가) 한 쪽(표)에 최대 ${wide[0].n}번 나와 열이 ${wide[0].n}개로 펼쳐졌습니다. 목록처럼 여러 건이 반복되는 문서라면 "행으로 나누기"를 선택해보세요.`;
    }
    return { headers, dataRows, pages };
  }

  // [쪽 기준 정렬] 같은 쪽에서 찾은 값끼리 한 행으로 묶는다.
  //  - 어떤 쪽에 특정 열의 값이 없으면 그 칸만 비워둔다. 다른 쪽의 값이 끌려와서 밀리는 일이 없다.
  //  - 값이 하나도 없는 쪽은 행이 만들어지지 않는다(건너뜀).
  //  - 문서 전체에서 모든 열이 많아야 한 번씩만 나오면(문서번호·작성일처럼 한 번씩만 있는 값들) 쪽이 달라도 한 행.
  //  - 한 쪽 안에 같은 열의 값이 여러 번 나오면 (dupMode)
  //      'cols': 값을 버리지 않고 옆 열로 펼친다 → 단어, 단어 (2), 단어 (3) …
  //      'rows': 가장 많이 나온 열을 기준으로 그 쪽 안에서 여러 건(행)으로 나눈다.
  //  - 쪽 정보를 못 얻은 문서(HWPX)는 표 번호를 묶음 기준으로 쓴다(표 하나가 한 행).
  // sources: 열 목록 [{rid, keyword}], byRid: rid -> 항목 배열
  function groupKeyOf(it){
    if (pagesDetected) return 'p' + it.page;
    return it.idType === 'table' ? 't' + it.id[0] : 'p1';
  }

  function alignByPage(byRid, sources){
    const listOf = (s) => byRid.get(s.rid) || [];
    const totalMax = sources.reduce((m, s) => Math.max(m, listOf(s).length), 0);
    if (totalMax === 0) return layoutMatrix(sources, [], []);

    if (totalMax === 1) {
      const firsts = sources.map(s => listOf(s)[0]);
      const pg = Math.min(...firsts.filter(Boolean).map(it => it.page));
      return layoutMatrix(sources, [firsts.map(it => it ? [it] : [])], [pg]);
    }

    const groups = new Map();
    sources.forEach((s, si) => {
      listOf(s).forEach(it => {
        const key = groupKeyOf(it);
        let g = groups.get(key);
        if (!g) { g = { page: it.page, minPos: it.pos, perSrc: sources.map(() => []) }; groups.set(key, g); }
        g.page = Math.min(g.page, it.page);
        g.minPos = Math.min(g.minPos, it.pos);
        g.perSrc[si].push(it);
      });
    });
    const groupList = [...groups.values()].sort((a, b) => (a.page - b.page) || (a.minPos - b.minPos));
    groupList.forEach(g => g.perSrc.forEach(a => a.sort((x, y) => x.pos - y.pos)));

    if (dupMode() === 'cols') {
      return layoutMatrix(sources, groupList.map(g => g.perSrc), groupList.map(g => g.page));
    }

    const matrix = [];
    const pages = [];
    groupList.forEach(g => {
      const perSrc = g.perSrc;
      const maxLen = perSrc.reduce((m, a) => Math.max(m, a.length), 0);
      if (maxLen === 0) return;
      if (maxLen === 1) {
        matrix.push(perSrc.map(a => a.length ? [a[0]] : []));
        pages.push(g.page);
        return;
      }
      let anchor = 0;
      perSrc.forEach((a, i) => { if (a.length > perSrc[anchor].length) anchor = i; });
      const bounds = perSrc[anchor].map(it => it.pos);
      const recs = bounds.map(() => sources.map(() => []));
      perSrc[anchor].forEach((it, i) => { recs[i][anchor] = [it]; });
      perSrc.forEach((arr, si) => {
        if (si === anchor) return;
        arr.forEach(it => {
          let idx = 0;
          for (let i = 0; i < bounds.length; i++) { if (it.pos >= bounds[i]) idx = i; else break; }
          if (recs[idx][si].length === 0) recs[idx][si] = [it];
        });
      });
      recs.forEach(r => { matrix.push(r); pages.push(g.page); });
    });
    return layoutMatrix(sources, matrix, pages);
  }

  // 쪽 기준으로 만든 표에는 맨 오른쪽에 "쪽" 열을 붙여 어느 쪽에서 나온 행인지 확인할 수 있게 한다.
  function appendPageColumn(agg){
    if (!agg || !agg.pages || !pagesDetected) return agg;
    return { headers: [...agg.headers, '쪽'], dataRows: agg.dataRows.map((r, i) => [...r, agg.pages[i]]) };
  }

  // 통합 결과(자동) 열 만들기.
  // ('쪽 단위로 행 맞추기'를 끈 경우의 예전 방식: 가장 많이 발견된 열을 "기준"으로 그 등장 위치 사이를 한 건으로 본다.
  //  기준 열이 없는 구간의 칸은 비워둔다.)
  function buildWideFromItems(items, sources){
    const byRid = new Map();
    sources.forEach(s => byRid.set(s.rid, []));
    items.forEach(it => { if (byRid.has(it.rid)) byRid.get(it.rid).push(it); });

    if (pageMode()) return alignByPage(byRid, sources);

    const listOf = (s) => byRid.get(s.rid) || [];
    const maxLen = sources.reduce((m, s) => Math.max(m, listOf(s).length), 0);
    if (maxLen <= 1) {
      return layoutMatrix(sources, [sources.map(s => listOf(s).length ? [listOf(s)[0]] : [])], null);
    }

    let anchor = 0;
    sources.forEach((s, i) => { if (listOf(s).length > listOf(sources[anchor]).length) anchor = i; });
    const anchorItems = listOf(sources[anchor]).slice().sort((a, b) => a.pos - b.pos);
    const bounds = anchorItems.map(it => it.pos);
    const recs = anchorItems.map(() => sources.map(() => []));
    anchorItems.forEach((it, i) => { recs[i][anchor] = [it]; });
    sources.forEach((s, si) => {
      if (si === anchor) return;
      listOf(s).forEach(it => {
        let idx = 0;
        for (let i = 0; i < bounds.length; i++) { if (it.pos >= bounds[i]) idx = i; else break; }
        if (recs[idx][si].length === 0) recs[idx][si] = [it];
      });
    });
    return layoutMatrix(sources, recs, null);
  }

  function computeAggregate(sources){
    if (!aggSource) return null;
    const items = aggSource.items;

    if (aggFormat === 'long') {
      const L = sourceLabelMap();
      const hasLine = items.some(it => it.idType === 'line');
      const hasTable = items.some(it => it.idType === 'table');
      const mixed = hasLine && hasTable;
      const idLabels = mixed ? ['구분', '식별자'] : (hasTable ? ['표 번호', '행 번호'] : ['줄 번호']);
      function idValues(it){
        if (mixed) return [it.idType === 'table' ? '표' : '줄', it.idType === 'table' ? `표${it.id[0]}-행${it.id[1]}` : `${it.id[0]}줄`];
        return it.id;
      }
      const withPage = pagesDetected;
      const headers = [...(withPage ? ['쪽'] : []), ...idLabels, '검색어', '값'];
      const dataRows = items.map(it => [...(withPage ? [it.page] : []), ...idValues(it), L.get(it.rid) || it.keyword, it.value]);
      return { headers, dataRows };
    }

    return appendPageColumn(buildWideFromItems(items, sources));
  }

  function updateDownloadEnabled(){
    downloadBtn.disabled = (wordResults.length === 0 && lineResults.length === 0 && nextLineResults.length === 0 && tableResults.length === 0);
  }

  /* ---------- 렌더링 ---------- */
  function renderAggTable(keywords){
    const agg = computeAggregate(keywords);

    if (!agg || agg.dataRows.length === 0) {
      aggRows = [];
      aggEmpty.style.display = '';
      aggTableWrap.style.display = 'none';
      aggTableWrap.classList.add('hidden');
      aggTableWrap.innerHTML = '';
      if (aggSource) aggEmpty.textContent = '통합할 수 있는 일치 항목이 없습니다.';
      else if (lastModeFlags.word || lastModeFlags.line || lastModeFlags.nextline || lastModeFlags.table) aggEmpty.textContent = '통합할 결과가 없습니다. "뒤 단어·해당 줄·다음 줄·표 옆칸" 중 하나 이상에서 일치 항목이 있어야 만들어집니다.';
      else aggEmpty.textContent = '단어를 입력한 뒤 추출하기를 눌러주세요.';
      return;
    }

    aggRows = agg.dataRows;
    aggEmpty.style.display = 'none';
    aggTableWrap.style.display = '';
    // [수정] index.html에서 #agg-table-wrap이 처음부터 class="table-wrap hidden"으로 시작한다.
    // style.display만 바꾸면 CSS의 .hidden 규칙(주로 !important)에 가려 실제로는 안 보일 수 있어
    // 클래스를 직접 제거해준다. (병합 개수는 맞는데 표가 안 보이던 문제의 원인)
    aggTableWrap.classList.remove('hidden');

    const headHtml = ['번호', ...agg.headers].map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const bodyHtml = agg.dataRows.map((cells, i) => {
      const tds = cells.map(v => `<td>${v === '' ? '' : `<strong>${escapeHtml(v)}</strong>`}</td>`).join('');
      return `<tr><td>${i + 1}</td>${tds}</tr>`;
    }).join('');

    aggTableWrap.innerHTML = `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  }

  /* ---------- 엑셀 다운로드 ---------- */
  // 문서(HWPX/PDF) 안에 있던 값이 그대로 셀에 들어가므로, =,+,-,@,탭,캐리지리턴으로
  // 시작하는 값은 엑셀에서 수식으로 해석될 수 있어(수식/CSV 삽입 공격) 문자 앞에 표시를 붙여 무력화한다.
  function sanitizeCell(v){
    if (typeof v !== 'string' || v.length === 0) return v;
    return /^[=+\-@\t\r]/.test(v) ? ("'" + v) : v;
  }

  function sanitizeFilenamePart(s){
    return String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 50) || 'result';
  }

  downloadBtn.addEventListener('click', () => {
   try {
    const wb = XLSX.utils.book_new();
    let added = false;
    const L = sourceLabelMap();

    {
      if (wordResults.length > 0) {
        const P = pagesDetected;
        const rows = [['번호', ...(P ? ['쪽'] : []), '줄 번호', '검색어', '찾은 단어', '바로 다음 단어']];
        wordResults.forEach((r, i) => rows.push([i + 1, ...(P ? [r.page] : []), r.lineNo, L.get(r.rid) || r.keyword, sanitizeCell(r.found), sanitizeCell(r.next)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6}, ...(P ? [{wch:6}] : []), {wch:8},{wch:14},{wch:16},{wch:24}];
        XLSX.utils.book_append_sheet(wb, ws, '뒤 단어 결과');
        added = true;
      }

      if (lineResults.length > 0) {
        const P = pagesDetected;
        const rows = [['번호', ...(P ? ['쪽'] : []), '줄 번호', '검색어', '일치 횟수', '해당 줄 전체']];
        lineResults.forEach((r, i) => rows.push([i + 1, ...(P ? [r.page] : []), r.lineNo, L.get(r.rid) || r.keyword, r.matchCount, sanitizeCell(r.line)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6}, ...(P ? [{wch:6}] : []), {wch:8},{wch:14},{wch:10},{wch:70}];
        XLSX.utils.book_append_sheet(wb, ws, '해당 줄 결과');
        added = true;
      }

      if (nextLineResults.length > 0) {
        const P = pagesDetected;
        const rows = [['번호', ...(P ? ['쪽'] : []), '줄 번호', '검색어', '일치 횟수', '다음 줄 전체']];
        nextLineResults.forEach((r, i) => rows.push([i + 1, ...(P ? [r.page] : []), r.lineNo, L.get(r.rid) || r.keyword, r.matchCount, sanitizeCell(r.nextLine)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6}, ...(P ? [{wch:6}] : []), {wch:8},{wch:14},{wch:10},{wch:70}];
        XLSX.utils.book_append_sheet(wb, ws, '다음 줄 결과');
        added = true;
      }

      if (tableResults.length > 0) {
        const P = pagesDetected;
        const rows = [['번호', ...(P ? ['쪽'] : []), '표 번호', '행 번호', '검색어', '찾은 칸', '옆 칸 값']];
        tableResults.forEach((r, i) => rows.push([i + 1, ...(P ? [r.page] : []), r.tableNo, r.rowNo, L.get(r.rid) || r.keyword, sanitizeCell(r.found), sanitizeCell(r.next)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6}, ...(P ? [{wch:6}] : []), {wch:8},{wch:8},{wch:14},{wch:20},{wch:24}];
        XLSX.utils.book_append_sheet(wb, ws, '표 옆칸 결과');
        added = true;
      }

      const aggForExport = computeAggregate(lastSources);
      if (aggForExport && aggForExport.dataRows.length > 0) {
        const rows = [['번호', ...aggForExport.headers]];
        aggForExport.dataRows.forEach((cells, i) => rows.push([i + 1, ...cells.map(sanitizeCell)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6}, ...aggForExport.headers.map(() => ({wch:18}))];
        XLSX.utils.book_append_sheet(wb, ws, '통합 결과');
        added = true;
      }
    }

    if (!added) {
      // [수정] 아무 시트도 못 만들었는데 조용히 return만 하면 사용자는 버튼이 반응이 없다고
      // 느끼게 된다. 화면에 이유를 표시한다.
      statusEl.textContent = '다운로드할 결과가 없습니다. 먼저 "추출값 병합하기"를 눌러주세요.';
      return;
    }
    const label = sanitizeFilenamePart(lastSources.length > 0 ? lastSources[0].keyword : 'result');
    const filename = `단어추출_${label}.xlsx`;
    XLSX.writeFile(wb, filename);
    // [수정] 다운로드 버튼을 눌러도 화면에는 아무 확인 표시가 없어서, 실제로는 파일이
    // 다운로드 폴더에 저장됐는데도 "반응이 없다"고 느껴질 수 있었다. 완료 메시지를 보여준다.
    statusEl.textContent = `✅ "${filename}" 다운로드 완료 (브라우저의 다운로드 폴더를 확인해주세요)`;
   } catch (err) {
    // [수정] 예전에는 XLSX.writeFile() 호출 한 줄만 try/catch로 감싸서, 그 앞의 시트 생성
    // 과정(XLSX.utils.aoa_to_sheet 등)에서 예외가 나면 아무 표시도 없이 조용히 실패했다.
    // 버튼 클릭 전체를 감싸서 어떤 단계에서 실패하든 반드시 화면에 원인이 보이게 한다.
    statusEl.textContent = '다운로드 중 오류가 발생했습니다: ' + err.message;
    console.error('다운로드 오류:', err);
   }
  });

  /* ---------- 설정 저장/불러오기 (브라우저에 여러 개 이름 붙여 저장 / 파일 저장) ---------- */
  const SAVED_LIST_KEY = 'wordExtractorSettingsList_v1';
  const saveNameInput = document.getElementById('save-name-input');
  const savedSelect = document.getElementById('saved-select');
  const saveBrowserBtn = document.getElementById('save-browser-btn');
  const loadBrowserBtn = document.getElementById('load-browser-btn');
  const deleteBrowserBtn = document.getElementById('delete-browser-btn');
  const saveFileBtn = document.getElementById('save-file-btn');
  const loadFileBtn = document.getElementById('load-file-btn');
  const loadFileInput = document.getElementById('load-file-input');

  function flashSettingsButton(btn, message, resetText){
    btn.textContent = message;
    setTimeout(() => { btn.textContent = resetText; }, 1600);
  }

  // 현재 화면에 있는 단어 목록·모드·통합 결과 형식을 하나의 순수 데이터 객체로 모은다.
  function collectAllSettings(){
    const rows = [...keywordList.querySelectorAll('.keyword-row')].map(getRowData);
    const aggRadio = document.querySelector('input[name="agg-format"]:checked');
    return { version: 1, aggFormat: aggRadio ? aggRadio.value : 'wide', pageMode: pageMode(), dupMode: dupMode(), rows };
  }

  // 저장된 데이터로 단어 목록·모드·통합 결과 형식을 되살린다.
  function applyAllSettings(settings){
    if (!settings || !Array.isArray(settings.rows) || settings.rows.length === 0) {
      throw new Error('유효한 설정 데이터가 아닙니다.');
    }
    const rowsData = settings.rows.slice(0, MAX_KEYWORDS);
    keywordList.innerHTML = '';
    rowsData.forEach(rd => keywordList.appendChild(makeKeywordRow(rd)));
    updateKeywordCount();
    renumberKeywordRows();
    // 행이 새로 만들어졌으므로 이전 행에 붙어 있던 추출 결과는 비운다.
    wordResults = []; lineResults = []; nextLineResults = []; tableResults = [];
    aggRows = []; aggSource = null; lastSources = [];
    renderAggTable([]);
    updateDownloadEnabled();
    switchToTab('kw-1');
    updateContOptions();

    const fmt = settings.aggFormat === 'long' ? 'long' : 'wide';
    const radio = document.querySelector(`input[name="agg-format"][value="${fmt}"]`);
    if (radio) radio.checked = true;
    aggFormat = fmt;
    if (pageModeEl) pageModeEl.checked = settings.pageMode !== false;
    if (dupModeEl) dupModeEl.value = settings.dupMode === 'rows' ? 'rows' : 'cols';
    syncDupModeState();
  }

  function loadSavedList(){
    try {
      const raw = localStorage.getItem(SAVED_LIST_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveSavedList(list){
    localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
  }

  function formatSavedDate(iso){
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 드롭다운 목록을 저장된 항목들로 다시 채운다. keepName이 있으면 그 이름을 선택 상태로 유지한다.
  function refreshSavedSelect(keepName){
    const list = loadSavedList();
    const options = ['<option value="">저장목록</option>']
      .concat(list.map((item, i) => `<option value="${i}">${escapeHtml(item.name)} (${escapeHtml(formatSavedDate(item.savedAt))})</option>`));
    savedSelect.innerHTML = options.join('');
    if (keepName) {
      const idx = list.findIndex(item => item.name === keepName);
      if (idx >= 0) savedSelect.value = String(idx);
    }
  }

  function getSelectedSavedIndex(){
    const v = savedSelect.value;
    return v === '' ? -1 : Number(v);
  }

  refreshSavedSelect();

  saveBrowserBtn.addEventListener('click', () => {
    const name = saveNameInput.value.trim();
    if (!name) { flashSettingsButton(saveBrowserBtn, '이름을 입력하세요', '💾 현재 설정 저장'); return; }

    const list = loadSavedList();
    const existingIdx = list.findIndex(item => item.name === name);
    // 같은 이름이 있으면 확인 없이 바로 덮어쓴다.

    const entry = { name, savedAt: new Date().toISOString(), data: collectAllSettings() };
    if (existingIdx >= 0) list[existingIdx] = entry;
    else list.push(entry);

    saveSavedList(list);
    refreshSavedSelect(name);
    saveNameInput.value = '';
    flashSettingsButton(saveBrowserBtn, '✓ 저장됨', '💾 현재 설정 저장');
  });

  loadBrowserBtn.addEventListener('click', () => {
    const idx = getSelectedSavedIndex();
    if (idx < 0) { flashSettingsButton(loadBrowserBtn, '항목을 선택하세요', '📥 불러오기'); return; }
    const item = loadSavedList()[idx];
    if (!item) return;
    try {
      applyAllSettings(item.data);
      flashSettingsButton(loadBrowserBtn, '✓ 불러옴', '📥 불러오기');
    } catch (err) {
      flashSettingsButton(loadBrowserBtn, '불러오기 실패', '📥 불러오기');
    }
  });

  deleteBrowserBtn.addEventListener('click', () => {
    const idx = getSelectedSavedIndex();
    if (idx < 0) { flashSettingsButton(deleteBrowserBtn, '항목을 선택하세요', '🗑️ 삭제'); return; }
    const list = loadSavedList();
    const item = list[idx];
    if (!item) return;
    if (!confirm(`"${item.name}" 저장 항목을 삭제할까요?`)) return;
    list.splice(idx, 1);
    saveSavedList(list);
    refreshSavedSelect();
    flashSettingsButton(deleteBrowserBtn, '✓ 삭제됨', '🗑️ 삭제');
  });

  saveFileBtn.addEventListener('click', () => {
    const data = collectAllSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `단어추출_설정_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flashSettingsButton(saveFileBtn, '✓ 저장됨', '⬇️ 파일로 저장');
  });

  loadFileBtn.addEventListener('click', () => loadFileInput.click());

  loadFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        applyAllSettings(JSON.parse(ev.target.result));
        flashSettingsButton(loadFileBtn, '✓ 불러옴', '⬆️ 파일 불러오기');
      } catch (err) {
        flashSettingsButton(loadFileBtn, '파일 형식 오류', '⬆️ 파일 불러오기');
      }
      loadFileInput.value = '';
    };
    reader.onerror = () => {
      flashSettingsButton(loadFileBtn, '읽기 실패', '⬆️ 파일 불러오기');
      loadFileInput.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  });
})();
