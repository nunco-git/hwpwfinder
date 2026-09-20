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

  /* ---------- 단어 + 단어별 추출방식 행 (기본 6개, 2개씩 추가, 최대 20개) ---------- */
  function makeKeywordRow(defaults){
    const d = defaults || {
      word: false, line: false, nextline: false, table: false,
      wordOffset: 1, wordCount: 1, nextlineOffset: 1, nextlineCount: 1, tableOffset: 1, tableCount: 1
    };
    const row = document.createElement('div');
    row.className = 'keyword-row';
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
        </div>
        <div class="kw-actions">
          <button type="button" class="row-run-btn" title="이 단어만 지금 바로 추출합니다">추출하기</button>
          <input type="text" class="kw-exclude-input" placeholder="제외할 값" title="여기 입력한 값을 포함하는 추출 결과는 이 단어의 추출 결과에서 제거합니다 (쉼표로 여러 개 구분)" value="${escapeHtml(d.excludeValue || '')}">
          <button type="button" class="exclude-apply-btn" title="입력한 제외 값을 지금 바로 추출 결과에 적용합니다">제외값 반영</button>
          <button type="button" class="reflect-kw" title="이 단어의 추출 결과를 엑셀 열로 반영">✔ 반영</button>
          <button type="button" class="remove-kw" title="삭제">×</button>
        </div>
      </div>
    `;
    const kwInput = row.querySelector('.keyword-input');
    kwInput.addEventListener('input', updateReflectButtonStates);

    row.querySelector('.row-run-btn').addEventListener('click', () => {
      const runBtnEl = row.querySelector('.row-run-btn');
      const rowData = getRowData(row);
      if (!extractedText.trim()) { flashRunButton(runBtnEl, '파일 먼저 업로드'); return; }
      if (!rowData.keyword) { flashRunButton(runBtnEl, '단어를 입력하세요'); return; }
      if (!rowData.word && !rowData.line && !rowData.nextline && !rowData.table) { flashRunButton(runBtnEl, '방식을 선택하세요'); return; }
      extractForKeywordRow(rowData);
      updateDownloadEnabled();
      updateReflectButtonStates();

      // 이 행(추출위치)의 탭으로 바로 전환해서 결과를 보여준다.
      const posIdx = row.querySelector('.kw-index').textContent;
      switchToTab('kw-' + posIdx);

      const cnt = countResultsForKeyword(rowData.keyword);
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
      const removedCount = applyExcludeToKeyword(kw, excludeTerms);
      updateDownloadEnabled();
      updateReflectButtonStates();
      const posIdx = row.querySelector('.kw-index').textContent;
      if (activeTab === 'kw-' + posIdx) renderKeywordPreview(activeTab);
      updateCount();
      flashExcludeButton(btn, removedCount > 0 ? `${removedCount}건 제외됨` : '해당 값 없음');
    });

    row.querySelector('.reflect-kw').addEventListener('click', () => {
      const kw = kwInput.value.trim();
      const reflectBtn = row.querySelector('.reflect-kw');
      if (!kw) { flashReflectButton(reflectBtn, '단어를 입력하세요'); return; }
      let items = getResultItemsForKeyword(kw);
      if (items.length === 0) { flashReflectButton(reflectBtn, '추출 결과 없음'); return; }
      const excludeTerms = row.querySelector('.kw-exclude-input').value
        .split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (excludeTerms.length > 0) {
        items = items.filter(it => !excludeTerms.some(term => String(it.value).includes(term)));
      }
      if (items.length === 0) { flashReflectButton(reflectBtn, '제외 후 남은 값 없음'); return; }
      upsertCommittedColumn(kw, items);
      renderCommittedChips();
      updateReflectButtonStates();
      updateDownloadEnabled();
    });
    row.querySelector('.remove-kw').addEventListener('click', () => {
      if (keywordList.children.length > 1) { row.remove(); updateKeywordCount(); renumberKeywordRows(); }
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

  // 특정 키워드의 현재 추출 결과 중, excludeTerms 중 하나라도 값에 포함된 항목을 실제로 제거한다.
  // 반환값은 제거된 건수.
  function applyExcludeToKeyword(keyword, excludeTerms){
    const before = countResultsForKeyword(keyword);
    const matches = (v) => excludeTerms.some(t => String(v).includes(t));
    wordResults = wordResults.filter(r => r.keyword !== keyword || !matches(r.next));
    lineResults = lineResults.filter(r => r.keyword !== keyword || !matches(r.line));
    nextLineResults = nextLineResults.filter(r => r.keyword !== keyword || !matches(r.nextLine));
    tableResults = tableResults.filter(r => r.keyword !== keyword || !matches(r.next));
    return before - countResultsForKeyword(keyword);
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
    resortCommittedColumns();
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
    updateReflectButtonStates();
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
  let lastKeywords = [];
  let lastModeFlags = { word: false, line: false, nextline: false, table: false };
  let hwpxTables = null;
  let currentFileType = null; // 'hwpx' | 'pdf' | null
  let activeTab = 'kw-1';
  let committedColumns = []; // [{ keyword, items: [{idType, id, keyword, value}, ...] }] — "열에 반영"으로 확정된 단어들

  for (let i = 0; i < DEFAULT_KEYWORDS; i++) keywordList.appendChild(makeKeywordRow());
  updateKeywordCount();
  renumberKeywordRows();
  updateReflectButtonStates();
  switchToTab('kw-1');

  // 한 행(DOM)에서 키워드, 선택된 추출 방식, 번째/개수 설정을 읽어온다.
  function getRowData(rowEl){
    return {
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
      excludeValue: rowEl.querySelector('.kw-exclude-input').value.trim(),
    };
  }

  // 같은 단어를 중복 입력한 경우, 추출 방식 체크는 OR로 합쳐서 하나로 취급한다. (병합 시 사용)
  function getKeywordRows(){
    const map = new Map();
    const order = [];
    keywordList.querySelectorAll('.keyword-row').forEach(rowEl => {
      const flags = getRowData(rowEl);
      if (!flags.keyword) return;
      const kw = flags.keyword;
      if (!map.has(kw)) { map.set(kw, flags); order.push(kw); }
      else {
        const existing = map.get(kw);
        existing.word = existing.word || flags.word;
        existing.line = existing.line || flags.line;
        existing.nextline = existing.nextline || flags.nextline;
        existing.table = existing.table || flags.table;
        existing.wordOffset = Math.max(existing.wordOffset, flags.wordOffset);
        existing.wordCount = Math.max(existing.wordCount, flags.wordCount);
        existing.nextlineOffset = Math.max(existing.nextlineOffset, flags.nextlineOffset);
        existing.nextlineCount = Math.max(existing.nextlineCount, flags.nextlineCount);
        existing.tableOffset = Math.max(existing.tableOffset, flags.tableOffset);
        existing.tableCount = Math.max(existing.tableCount, flags.tableCount);
      }
    });
    return order.map(k => map.get(k));
  }

  /* ---------- 통합 결과 형식 토글 ---------- */
  document.querySelectorAll('input[name="agg-format"]').forEach(radio => {
    radio.addEventListener('change', () => {
      aggFormat = document.querySelector('input[name="agg-format"]:checked').value;
      renderAggTable(lastKeywords);
      if (activeTab === 'agg') updateCount();
    });
  });

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
        if (text) lines.push(text);
      });
    }
    if (lines.length === 0) {
      throw new Error('텍스트를 찾을 수 없습니다. 스캔본(이미지) PDF는 지원되지 않습니다.');
    }
    return lines.join('\n');
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
    currentFileType = null;

    try {
      if (isHwpx) {
        fileStatus.textContent = `"${file.name}" 에서 본문과 표를 추출하는 중...`;
        const result = await extractHwpxText(file);
        extractedText = result.text;
        hwpxTables = result.tables;
        currentFileType = 'hwpx';
        fileStatus.textContent = `"${file.name}" 불러옴 (표 ${result.tables.length}개 인식됨)`;
      } else if (isPdf) {
        fileStatus.textContent = `"${file.name}" 에서 텍스트를 추출하는 중...`;
        extractedText = await extractPdfText(file);
        currentFileType = 'pdf';
        fileStatus.textContent = `"${file.name}" 불러옴 (PDF 텍스트 · 표 옆칸 추출은 지원되지 않음)`;
      }
    } catch (err) {
      hwpxTables = null;
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
    currentFileType = null;
    fileStatus.textContent = '아직 불러온 파일이 없습니다.';

    keywordList.innerHTML = '';
    for (let i = 0; i < DEFAULT_KEYWORDS; i++) keywordList.appendChild(makeKeywordRow());
    updateKeywordCount();
    renumberKeywordRows();

    document.querySelector('input[name="agg-format"][value="wide"]').checked = true;
    aggFormat = 'wide';

    wordResults = []; lineResults = []; nextLineResults = []; tableResults = [];
    aggRows = []; aggSource = null; lastKeywords = [];
    lastModeFlags = { word: false, line: false, nextline: false, table: false };
    committedColumns = [];
    renderCommittedChips();
    updateReflectButtonStates();
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

  function parseTable(tblNode){
    const rows = [];
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
      if (cells.length > 0) rows.push(cells);
    }
    return rows;
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
    const tables = [];

    for (const name of sectionFiles) {
      const xmlStr = await zip.files[name].async('string');
      const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
      if (doc.querySelector('parsererror')) {
        throw new Error('본문 XML을 해석할 수 없습니다.');
      }

      const tNodes = doc.getElementsByTagName('hp:t');
      const paraMap = new Map();
      for (let i = 0; i < tNodes.length; i++) {
        const t = tNodes[i];
        const node = closestByTag(t, 'hp:p');
        if (!node) continue;
        if (!paraMap.has(node)) paraMap.set(node, []);
        paraMap.get(node).push(t.textContent);
      }
      for (const parts of paraMap.values()) {
        lines.push(parts.join(''));
      }

      const tblNodes = doc.getElementsByTagName('hp:tbl');
      for (let ti = 0; ti < tblNodes.length; ti++) {
        const rows = parseTable(tblNodes[ti]);
        if (rows.length > 0) tables.push(rows);
      }
    }

    return { text: lines.join('\n'), tables };
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

    const rows = [];
    wordResults.filter(r => r.keyword === keyword).forEach(r => rows.push({ mode: '뒤 단어', loc: `${r.lineNo}줄`, value: r.next }));
    lineResults.filter(r => r.keyword === keyword).forEach(r => rows.push({ mode: '해당 줄', loc: `${r.lineNo}줄`, value: r.line }));
    nextLineResults.filter(r => r.keyword === keyword).forEach(r => rows.push({ mode: '다음 줄', loc: `${r.lineNo}줄`, value: r.nextLine }));
    tableResults.filter(r => r.keyword === keyword).forEach(r => rows.push({ mode: '표 옆칸', loc: `표${r.tableNo}-행${r.rowNo}`, value: r.next }));

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
      n = keyword ? countResultsForKeyword(keyword) : 0;
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

  function extractForKeywordRow(rowData){
    const keyword = rowData.keyword;
    wordResults = wordResults.filter(r => r.keyword !== keyword);
    lineResults = lineResults.filter(r => r.keyword !== keyword);
    nextLineResults = nextLineResults.filter(r => r.keyword !== keyword);
    tableResults = tableResults.filter(r => r.keyword !== keyword);

    const lines = extractedText.split(/\r\n|\r|\n/);

    lines.forEach((line, lineIdx) => {
      const lineNo = lineIdx + 1;
      const tokens = line.split(/\s+/).filter(t => t.length > 0);

      if (rowData.word) {
        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i] === keyword) {
            const start = i + rowData.wordOffset;
            const nextTokens = tokens.slice(start, start + rowData.wordCount);
            if (nextTokens.length > 0) {
              wordResults.push({ lineNo, keyword, found: tokens[i], next: nextTokens.join(' ') });
            }
          }
        }
      }

      if (rowData.line && line.includes(keyword)) {
        const matchCount = tokens.filter(t => t === keyword).length || (line.split(keyword).length - 1);
        lineResults.push({ lineNo, keyword, matchCount, line });
      }

      if (rowData.nextline && line.includes(keyword)) {
        const matchCount = tokens.filter(t => t === keyword).length || (line.split(keyword).length - 1);
        const start = lineIdx + rowData.nextlineOffset;
        const nextChunk = lines.slice(start, start + rowData.nextlineCount).join('\n');
        if (nextChunk.length > 0) {
          nextLineResults.push({ lineNo, keyword, matchCount, nextLine: nextChunk });
        }
      }
    });

    if (rowData.table) {
      if (hwpxTables && hwpxTables.length > 0) {
        hwpxTables.forEach((rows, tIdx) => {
          rows.forEach((cells, rIdx) => {
            for (let c = 0; c < cells.length; c++) {
              if (cells[c].includes(keyword)) {
                const nextCells = collectDirectionalCells(rows, cells, rIdx, c, rowData.tableDirection, rowData.tableOffset, rowData.tableCount, rowData.tableStopWord);
                if (nextCells.length > 0) {
                  tableResults.push({ tableNo: tIdx + 1, rowNo: rIdx + 1, keyword, found: cells[c], next: nextCells.join(' / ') });
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
  }

  function countResultsForKeyword(keyword){
    return wordResults.filter(r => r.keyword === keyword).length
      + lineResults.filter(r => r.keyword === keyword).length
      + nextLineResults.filter(r => r.keyword === keyword).length
      + tableResults.filter(r => r.keyword === keyword).length;
  }

  // "추출값 병합하기": 등록된 모든 단어에 대해 지금 설정된 방식으로 추출을 실행한 뒤,
  // 그 결과들을 모아 통합 결과(자동)를 만든다.
  // (예전에는 각 행의 "추출하기"를 미리 눌러둔 결과만 모았는데, 그러면 단어를 추가하거나
  //  옵션을 바꾼 뒤 바로 이 버튼을 누르면 아무 데이터도 없어서 통합 결과와 다운로드가
  //  전부 비어있는 것처럼 보이는 문제가 있었다. 여기서 직접 추출까지 수행해 해결한다.)
  runBtn.addEventListener('click', () => {
    statusEl.textContent = '';
    const kwRows = getKeywordRows();

    if (kwRows.length === 0) { statusEl.textContent = '찾을 단어를 한 개 이상 입력해주세요.'; return; }

    if (!extractedText.trim()) { statusEl.textContent = '파일을 먼저 업로드해주세요.'; return; }

    kwRows.forEach(rowData => {
      if (rowData.word || rowData.line || rowData.nextline || rowData.table) {
        extractForKeywordRow(rowData);
      }
    });

    lastModeFlags = {
      word: kwRows.some(r => r.word),
      line: kwRows.some(r => r.line),
      nextline: kwRows.some(r => r.nextline),
      table: kwRows.some(r => r.table),
    };

    setAggSource();
    lastKeywords = kwRows.map(r => r.keyword);

    renderAggTable(lastKeywords);
    switchToTab('agg');
    updateDownloadEnabled();
    updateReflectButtonStates();

    if (wordResults.length === 0 && lineResults.length === 0 && nextLineResults.length === 0 && tableResults.length === 0) {
      statusEl.textContent = '병합할 결과가 없습니다. 먼저 각 단어의 "추출하기"를 눌러주세요.';
    } else if (!statusEl.textContent) {
      statusEl.textContent = `${lastKeywords.length}개 단어의 결과를 병합했습니다.`;
    }
  });

  // 통합 결과의 원본: 뒤 단어 / 해당 줄 / 다음 줄 / 표 옆칸 네 가지 결과를 모두 하나의 목록으로 합친다.
  // idType이 'line'이면 줄 번호로, 'table'이면 (표 번호, 행 번호)로 같은 레코드를 묶는다.
  function setAggSource(){
    const items = [];
    wordResults.forEach(it => items.push({ idType: 'line', id: [it.lineNo], keyword: it.keyword, value: it.next }));
    lineResults.forEach(it => items.push({ idType: 'line', id: [it.lineNo], keyword: it.keyword, value: it.line }));
    nextLineResults.forEach(it => items.push({ idType: 'line', id: [it.lineNo], keyword: it.keyword, value: it.nextLine }));
    tableResults.forEach(it => items.push({ idType: 'table', id: [it.tableNo, it.rowNo], keyword: it.keyword, value: it.next }));
    aggSource = items.length > 0 ? { items } : null;
  }

  // 특정 키워드가 (현재 run 결과 안에서) 만들어낸 항목들만 뽑아온다 — "열에 반영" 버튼이 사용.
  function getResultItemsForKeyword(keyword){
    const items = [];
    wordResults.forEach(it => { if (it.keyword === keyword) items.push({ idType: 'line', id: [it.lineNo], keyword: it.keyword, value: it.next }); });
    lineResults.forEach(it => { if (it.keyword === keyword) items.push({ idType: 'line', id: [it.lineNo], keyword: it.keyword, value: it.line }); });
    nextLineResults.forEach(it => { if (it.keyword === keyword) items.push({ idType: 'line', id: [it.lineNo], keyword: it.keyword, value: it.nextLine }); });
    tableResults.forEach(it => { if (it.keyword === keyword) items.push({ idType: 'table', id: [it.tableNo, it.rowNo], keyword: it.keyword, value: it.next }); });
    return items;
  }

  // items(줄 또는 표 식별자를 가진 결과 목록)를 keywords 순서대로 칼럼화한 { headers, dataRows }로 변환.
  // 통합 결과(자동)와 반영된 열 병합(수동) 둘 다 이 함수를 공유한다.
  //
  // [수정 이력]
  // 1차: 예전에는 줄 번호/표 위치(식별자)가 정확히 같은 결과끼리만 한 행으로 묶었다. 그런데
  //      "문서번호", "작성일", "담당자"처럼 문서 전체에 한 번씩만 나오는 값들은 서로 다른 줄에
  //      있어서 식별자가 안 겹쳤고, 그 결과 값들이 전부 다른 행으로 흩어졌다(병합이 전혀 안
  //      되는 것처럼 보임). 그래서 식별자를 무시하고 "나온 순서대로" 옆 칸에 나란히 배치하도록
  //      바꿨다.
  // 2차: 그런데 표에서 여러 행(레코드)을 반복 추출하는 경우, 중간의 한 레코드에서 특정
  //      단어를 못 찾으면(예: 3명 중 2번째 사람의 "부서" 칸이 비어있음) 순서 기반 배치는
  //      그 다음 레코드의 값을 앞으로 당겨버려서 이후 모든 행이 한 칸씩 밀리는 문제가 있었다.
  //      그래서 줄 번호/표 위치가 정확히 같은 것끼리만 묶도록 되돌렸다.
  // 3차(이번 수정): 그런데 실제 문서는 표가 아니라, 한 사람(레코드)의 정보가 "이름 / 직급 /
  //      부서"처럼 여러 줄에 걸쳐 나뉘어 있는 경우가 많다. 이때는 줄 번호가 단어마다 다 달라서
  //      2차 방식(정확히 같은 줄만 묶기)으로는 애초에 하나도 안 묶이고 전부 흩어진 행으로
  //      나온다. 그래서 이제는 "레코드 경계"를 다음과 같이 자동으로 찾는다:
  //      - 등록된 단어 중 문서에서 가장 많이 발견된 단어를 "기준 단어"로 삼는다(보통 매
  //        레코드마다 한 번씩 나오는 항목, 예: 이름).
  //      - 기준 단어가 나온 위치(줄 번호, 또는 표의 표번호+행번호)들을 순서대로 나열해서, 그
  //        사이 구간을 레코드 하나의 범위로 본다.
  //      - 다른 단어들의 결과는 "어느 구간(레코드)에 위치하는지"를 보고 그 레코드의 칸에
  //        채운다. 구간 안에 값이 없으면(못 찾았으면) 그 칸은 빈 값으로 남기고, 다음 레코드의
  //        값이 앞으로 당겨오지 않는다.
  //      표 안에서 반복되는 경우(표 옆칸 추출)도 표번호+행번호를 좌표로 써서 똑같이 처리되므로
  //      기존처럼 정확히 동작한다.
  function buildWideFromItems(items, keywords){
    const byKeyword = new Map();
    keywords.forEach(kw => byKeyword.set(kw, []));
    items.forEach(it => {
      if (!byKeyword.has(it.keyword)) byKeyword.set(it.keyword, []);
      byKeyword.get(it.keyword).push(it);
    });

    const maxLen = keywords.reduce((m, kw) => Math.max(m, byKeyword.get(kw).length), 0);
    const headers = [...keywords];

    if (maxLen <= 1) {
      // 모든 단어가 문서에 많아야 한 번씩만 나온 경우: 줄/표 위치가 달라도 상관없이 한 행으로 합친다.
      const row = keywords.map(kw => {
        const arr = byKeyword.get(kw);
        return arr.length > 0 ? arr[0].value : '';
      });
      return { headers, dataRows: [row] };
    }

    // 문서 안에서의 위치를 하나의 정렬 가능한 숫자로 바꾼다. 표 위치는 (표번호, 행번호)를
    // 하나의 큰 수로 합쳐서 줄 번호와 섞여도 각각 순서대로 비교 가능하게 만든다.
    function sortKeyOf(it){
      return it.idType === 'table' ? (it.id[0] * 1000000 + it.id[1]) : it.id[0];
    }

    // 가장 많이 발견된 단어를 "기준 단어"(레코드 경계)로 삼는다. 개수가 같으면 등록 순서상
    // 앞선 단어를 우선한다.
    let anchorKw = keywords[0];
    let anchorLen = byKeyword.get(anchorKw).length;
    keywords.forEach(kw => {
      const len = byKeyword.get(kw).length;
      if (len > anchorLen) { anchorKw = kw; anchorLen = len; }
    });

    const anchorItems = byKeyword.get(anchorKw).slice().sort((a, b) => sortKeyOf(a) - sortKeyOf(b));
    const boundaries = anchorItems.map(sortKeyOf);

    // sortKey가 몇 번째 레코드(기준 단어의 몇 번째 등장) 구간에 속하는지 찾는다.
    // boundaries[i] <= sortKey인 가장 큰 i를 반환(기준 단어의 첫 등장보다 앞선 값은 0번 레코드로 취급).
    function recordIndexFor(sortKey){
      let idx = 0;
      for (let i = 0; i < boundaries.length; i++) {
        if (sortKey >= boundaries[i]) idx = i; else break;
      }
      return idx;
    }

    const anchorColIdx = keywords.indexOf(anchorKw);
    const dataRows = anchorItems.map(() => keywords.map(() => ''));
    anchorItems.forEach((it, i) => { dataRows[i][anchorColIdx] = it.value; });

    keywords.forEach(kw => {
      if (kw === anchorKw) return;
      const colIdx = keywords.indexOf(kw);
      byKeyword.get(kw).forEach(it => {
        const idx = recordIndexFor(sortKeyOf(it));
        if (dataRows[idx][colIdx] === '') dataRows[idx][colIdx] = it.value; // 한 레코드에 같은 단어가 여러 번 걸리면 첫 값을 사용
      });
    });

    return { headers, dataRows };
  }

  function computeAggregate(keywords){
    if (!aggSource) return null;
    const items = aggSource.items;

    if (aggFormat === 'long') {
      const hasLine = items.some(it => it.idType === 'line');
      const hasTable = items.some(it => it.idType === 'table');
      const mixed = hasLine && hasTable;
      const idLabels = mixed ? ['구분', '식별자'] : (hasTable ? ['표 번호', '행 번호'] : ['줄 번호']);
      function idValues(it){
        if (mixed) return [it.idType === 'table' ? '표' : '줄', it.idType === 'table' ? `표${it.id[0]}-행${it.id[1]}` : `${it.id[0]}줄`];
        return it.id;
      }
      const headers = [...idLabels, '검색어', '값'];
      const dataRows = items.map(it => [...idValues(it), it.keyword, it.value]);
      return { headers, dataRows };
    }

    return buildWideFromItems(items, keywords);
  }

  /* ---------- 엑셀 열에 반영 (수동 병합) ---------- */
  // 어떤 단어가 현재 몇 번째 행(추출위치)에 있는지 찾는다. 행이 삭제되어 없으면 null.
  function getRowPositionForKeyword(keyword){
    const rows = [...keywordList.children];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].querySelector('.keyword-input').value.trim() === keyword) return i + 1;
    }
    return null;
  }

  // 반영 순서가 아니라, 단어 목록에서의 실제 위치(행 순서) 기준으로 committedColumns를 정렬해서
  // 엑셀 열 번호가 항상 각 행의 위치와 일치하도록 맞춘다. (위치를 찾지 못하면 맨 뒤)
  function resortCommittedColumns(){
    committedColumns.sort((a, b) => {
      const pa = getRowPositionForKeyword(a.keyword);
      const pb = getRowPositionForKeyword(b.keyword);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb;
    });
  }

  function upsertCommittedColumn(keyword, items){
    const idx = committedColumns.findIndex(c => c.keyword === keyword);
    if (idx >= 0) { committedColumns[idx] = { keyword, items }; return; }
    committedColumns.push({ keyword, items });
    resortCommittedColumns();
  }

  function removeCommittedColumn(keyword){
    committedColumns = committedColumns.filter(c => c.keyword !== keyword);
  }

  // 반영된 열은 줄 번호나 표 행 번호가 서로 달라도(문서 안에서 값들이 다른 줄에 있어도)
  // "같은 행에서 오른쪽으로 계속 반영"되도록, 식별자로 묶지 않고 각 열이 반영된 순서(=문서에
  // 나온 순서) 그대로 나란히 배치한다. 즉 각 단어의 n번째 값끼리 같은 행에 놓인다.
  function computeCommittedMerge(){
    if (committedColumns.length === 0) return null;
    const keywords = committedColumns.map(c => c.keyword);
    const maxLen = Math.max(...committedColumns.map(c => c.items.length));
    const dataRows = [];
    for (let i = 0; i < maxLen; i++) {
      dataRows.push(committedColumns.map(c => (c.items[i] ? c.items[i].value : '')));
    }
    return { headers: keywords, dataRows };
  }

  function renderCommittedChips(){
    const container = document.getElementById('kw-committed');
    container.innerHTML = committedColumns.map(c => `
      <span class="kw-chip">${escapeHtml(c.keyword)}<button type="button" data-kw="${escapeHtml(c.keyword)}" title="반영 취소">×</button></span>
    `).join('');
    container.querySelectorAll('button[data-kw]').forEach(btn => {
      btn.addEventListener('click', () => {
        removeCommittedColumn(btn.dataset.kw);
        renderCommittedChips();
        updateReflectButtonStates();
        updateDownloadEnabled();
      });
    });
  }

  function updateReflectButtonStates(){
    const committedKeywords = new Set(committedColumns.map(c => c.keyword));
    keywordList.querySelectorAll('.keyword-row').forEach((row, i) => {
      const kw = row.querySelector('.keyword-input').value.trim();
      const btn = row.querySelector('.reflect-kw');
      const colNum = i + 2; // 1열은 "번호" 열, 이 행은 항상 자기 위치+1 열
      const isCommitted = kw && committedKeywords.has(kw);
      btn.classList.toggle('active', isCommitted);
      btn.textContent = isCommitted ? `엑셀파일 ${colNum}열에 반영됨` : `엑셀파일 ${colNum}열에 반영`;
    });
  }

  function flashReflectButton(btn, message){
    btn.textContent = message;
    setTimeout(() => { updateReflectButtonStates(); }, 1200);
  }

  function updateDownloadEnabled(){
    downloadBtn.disabled = (wordResults.length === 0 && lineResults.length === 0 && nextLineResults.length === 0 && tableResults.length === 0 && committedColumns.length === 0);
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

    // "열에 반영"으로 확정한 데이터가 있으면, 다른 개별 결과/통합 결과 시트는 빼고
    // "반영된 열 병합" 시트 하나만 다운로드한다.
    const committedMerge = computeCommittedMerge();
    if (committedMerge && committedMerge.dataRows.length > 0) {
      const rows = [['번호', ...committedMerge.headers]];
      committedMerge.dataRows.forEach((cells, i) => rows.push([i + 1, ...cells.map(sanitizeCell)]));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{wch:6}, ...committedMerge.headers.map(() => ({wch:18}))];
      XLSX.utils.book_append_sheet(wb, ws, '반영된 열 병합');
      added = true;
    } else {
      if (wordResults.length > 0) {
        const rows = [['번호', '줄 번호', '검색어', '찾은 단어', '바로 다음 단어']];
        wordResults.forEach((r, i) => rows.push([i + 1, r.lineNo, r.keyword, sanitizeCell(r.found), sanitizeCell(r.next)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6},{wch:8},{wch:14},{wch:16},{wch:24}];
        XLSX.utils.book_append_sheet(wb, ws, '뒤 단어 결과');
        added = true;
      }

      if (lineResults.length > 0) {
        const rows = [['번호', '줄 번호', '검색어', '일치 횟수', '해당 줄 전체']];
        lineResults.forEach((r, i) => rows.push([i + 1, r.lineNo, r.keyword, r.matchCount, sanitizeCell(r.line)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6},{wch:8},{wch:14},{wch:10},{wch:70}];
        XLSX.utils.book_append_sheet(wb, ws, '해당 줄 결과');
        added = true;
      }

      if (nextLineResults.length > 0) {
        const rows = [['번호', '줄 번호', '검색어', '일치 횟수', '다음 줄 전체']];
        nextLineResults.forEach((r, i) => rows.push([i + 1, r.lineNo, r.keyword, r.matchCount, sanitizeCell(r.nextLine)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6},{wch:8},{wch:14},{wch:10},{wch:70}];
        XLSX.utils.book_append_sheet(wb, ws, '다음 줄 결과');
        added = true;
      }

      if (tableResults.length > 0) {
        const rows = [['번호', '표 번호', '행 번호', '검색어', '찾은 칸', '옆 칸 값']];
        tableResults.forEach((r, i) => rows.push([i + 1, r.tableNo, r.rowNo, r.keyword, sanitizeCell(r.found), sanitizeCell(r.next)]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:6},{wch:8},{wch:8},{wch:14},{wch:20},{wch:24}];
        XLSX.utils.book_append_sheet(wb, ws, '표 옆칸 결과');
        added = true;
      }

      const aggForExport = computeAggregate(lastKeywords);
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
    const label = sanitizeFilenamePart(lastKeywords.length > 0 ? lastKeywords[0] : 'result');
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
    return { version: 1, aggFormat: aggRadio ? aggRadio.value : 'wide', rows };
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
    updateReflectButtonStates();

    const fmt = settings.aggFormat === 'long' ? 'long' : 'wide';
    const radio = document.querySelector(`input[name="agg-format"][value="${fmt}"]`);
    if (radio) radio.checked = true;
    aggFormat = fmt;
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
