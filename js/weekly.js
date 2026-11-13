/*
 * build-2611-10 (v2) · 주간업무보고 자동화 — 엔진
 * 엑셀에서 4개 항목 추출 · 금주/차주 배치 · 상태(진행 · 완료 · 지연) 집계 · 중복 의심 · 이력 · 보고서 표는 전부 여기 둔다.
 * js/app.js 는 그리기와 저장만 한다. 엑셀에 없는 내용은 만들지 않고, 원문을 요약하거나 고치지 않는다.
 *
 * 데이터 구조(추후 Supabase 표로 그대로 옮길 수 있게 납작하게 둔다)
 *   tasks  : id, owner, work_date, title, due_date, detail, field, status('' | 진행 | 완료), needs_decision, decision_request,
 *            decision_due, reviewed, is_sample, source_file, source_sheet, created_at, updated_at
 *   logs   : id, type('status' | 'upload' | 'edit' | 'delete'), at, owner, task_id, text
 *   지연은 저장하지 않는다 — 완료가 아니고 마감일이 오늘보다 앞이면 지연으로 계산한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Weekly = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FIELDS = ['복리후생 / 총무', '사회공헌 / 의전', '자산', '비상계획'];
  var STATES = ['진행', '완료', '지연'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function toDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function addDays(s, n) { var d = toDate(s); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); }
  /** 그 날짜가 속한 주의 월요일 */
  function weekStart(s) { var d = toDate(s); if (!d) return ''; d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function weekLabel(w, today) {
    if (!w) return '날짜 없음';
    var t0 = weekStart(today), tag = w === t0 ? ' (금주)' : w === addDays(t0, 7) ? ' (차주)' : w === addDays(t0, -7) ? ' (전주)' : '';
    return w.slice(5).replace('-', '.') + ' ~ ' + addDays(w, 6).slice(5).replace('-', '.') + tag;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function txt(v) { return v == null ? '' : String(v); }
  function norm(s) { return txt(s).toLowerCase().replace(/[\s\-_.·,()\[\]/]/g, ''); }

  /* ───────────── 날짜 읽기 ───────────── */
  /** 엑셀 날짜(숫자 · Date · 글자) → YYYY-MM-DD. 읽지 못하면 ''. 연도가 없으면 baseYear(올린 해) */
  function parseDate(v, baseYear) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return isNaN(v) ? '' : iso(v);
    if (typeof v === 'number') { if (v < 20000 || v > 80000) return ''; var d = new Date(Math.round((v - 25569) * 86400000)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    var s = txt(v).trim().replace(/\([^)]*\)/g, '').trim(), m;
    var ok = function (y, mo, da) { var dd = new Date(y, mo - 1, da); return dd.getFullYear() === y && dd.getMonth() === mo - 1 && dd.getDate() === da ? y + '-' + pad(mo) + '-' + pad(da) : ''; };
    if ((m = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/.exec(s))) return ok(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return ok(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})$/.exec(s))) return ok(2000 + +m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/.exec(s))) return ok(baseYear || new Date().getFullYear(), +m[1], +m[2]);
    return '';
  }

  /* ───────────── 엑셀에서 4개 항목 추출 ───────────── */
  var HEAD = [
    ['work_date', /^(날짜|일자|업무일|업무일자|작성일|date)$/],
    ['title', /^(주요내용|주요업무|업무내용|업무명|업무제목|제목|내용|title)$/],
    ['due_date', /^(마감일|마감|기한|완료예정일|완료예정|예정일|납기|duedate|due)$/],
    ['detail', /^(세부내용|세부사항|상세내용|상세|비고|detail|details)$/],
    ['field', /^(업무분류|업무분야|분류|분야|category)$/],
    ['owner', /^(담당자|담당|작성자|담당자명|owner)$/]
  ];
  /* ───────────── 담당자(v2.2) ─────────────
   * 엑셀에 적혀 있으면 그 값, 비어 있으면 제목 · 세부내용에서 찾는다. 찾는 방법은 두 가지뿐이다:
   *  ① 「담당: 홍길동」「담당자 홍길동」처럼 적혀 있는 이름  ② 이미 등록된 담당자 이름이 글에 그대로 나오는 경우(한 사람일 때만)
   * 그 밖에는 이름을 지어내지 않고 빈칸으로 둔다. */
  function findOwner(title, detail, known) {
    var text = txt(title) + '\n' + txt(detail), m = /담당자?\s*[:：)\]]?\s*([가-힣]{2,4})(?:\s*(?:님|씨|과장|대리|차장|부장|사원|주임|책임|매니저|팀장|프로))?(?![가-힣])/.exec(text);
    var list = (known || []).filter(Boolean);
    if (m && !STOP.test(m[1]) && !/^(미정|없음|미지정|확인|지정|배정|변경|교체|부재)$/.test(m[1])) { var hit = list.filter(function (o) { return o === m[1]; })[0]; return { owner: hit || m[1], why: '「' + m[0].trim() + '」', known: !!hit }; }
    var found = list.filter(function (o) { return o.length >= 2 && text.indexOf(o) >= 0; });
    found = found.filter(function (o) { return !found.some(function (x) { return x !== o && x.indexOf(o) >= 0; }); });   // 「김민수」와 「민수」가 함께 걸리면 긴 쪽
    if (found.length === 1) return { owner: found[0], why: '등록된 담당자 이름', known: true };
    return { owner: '', why: found.length > 1 ? '이름이 여럿 나옴(' + found.join(', ') + ')' : '', known: false };
  }
  /* ───────────── 업무분류(v2.1) ─────────────
   * 엑셀에 적혀 있으면 그 값을 쓰고, 비어 있으면 제목 · 세부내용의 낱말로 자동 분류한다.
   * 자동 분류는 낱말 규칙이다(외부 AI 를 부르지 않는다). 맞는 낱말이 없거나 두 분류가 같은 점수면 미분류로 두고 사람이 고른다. */
  var NONE = '미분류';
  var FIELD_WORDS = [
    ['복리후생 / 총무', ['복리후생', '복지', '건강검진', '검진', '구내식당', '식당', '급식', '식수', '통근', '셔틀', '기숙사', '사택', '숙소', '동호회', '경조', '명절', '선물', '휴양', '콘도', '근무복', '유니폼', '사무용품', '비품', '소모품', '청소', '미화', '우편', '택배', '총무', '주차', '법인차', '업무용 차량', '간식', '포상', '체육대회', '워크숍', '사내 행사', '휴게', '자판기', '정수기', '명함', '인쇄']],
    ['사회공헌 / 의전', ['사회공헌', '봉사', '기부', '후원', '나눔', '지역사회', '상생', '장학', '김장', '연탄', '헌혈', '의전', '내방', '방문객', '귀빈', 'vip', '영접', '환영', '대외', '지자체', '시청', '구청', '협약', 'mou', '간담회', '기념식', '준공식', '시상식', '초청']],
    ['자산', ['자산', '부동산', '임대', '임차', '토지', '건물', '매각', '매입', '취득', '감가', '재물', '실사', '등기', '재산세', '보험', '고정자산', '유휴', '불용', '처분', '이전 설치', '리모델링', '보수 공사', '시설 공사', '시설물', '창고']],
    ['비상계획', ['비상', '예비군', '민방위', '을지', '충무', '통합방위', '방호', '경비', '보안', '소방', '화재', '대피', '재난', '재해', '안보', '비상연락', '비상 연락', '출입 통제', 'cctv', '상황실', '훈련', '점검표']]
  ];
  /** 글자 → 업무분류. FIELDS 중 하나, '미분류'(사용자가 미분류로 적음), ''(비었거나 모르는 값) */
  function normField(v) {
    var k = norm(v); if (!k) return '';
    for (var i = 0; i < FIELDS.length; i++) if (norm(FIELDS[i]) === k) return FIELDS[i];
    return k === norm(NONE) ? NONE : '';
  }
  /** 제목 · 세부내용 → { field, why:[맞은 낱말], scores }. field 가 '' 이면 미분류 */
  function classify(title, detail) {
    var text = (txt(title) + ' ' + txt(title) + ' ' + txt(detail)).toLowerCase(), best = null, second = 0, scores = {};
    FIELD_WORDS.forEach(function (fw) {
      var hit = [], n = 0;
      fw[1].forEach(function (w) { var c = text.split(w).length - 1; if (c) { hit.push(w); n += c; } });
      scores[fw[0]] = n;
      if (n && (!best || n > best.n)) { second = best ? best.n : second; best = { field: fw[0], n: n, why: hit }; } else if (n > second) second = n;
    });
    if (!best || best.n === second) return { field: '', why: best ? ['여러 분류에 걸림'] : [], scores: scores };
    return { field: best.field, why: best.why, scores: scores };
  }
  function headKey(v) { var k = norm(v); if (!k) return ''; for (var i = 0; i < HEAD.length; i++) if (HEAD[i][1].test(k)) return HEAD[i][0]; return ''; }
  /** 머리줄 찾기 — 「주요내용」이 있고 4개 중 2개 이상이 한 줄에 있는 첫 줄(위 20줄 안). 열 순서는 상관없다 */
  function inspectSheet(aoa) {
    for (var r = 0; r < Math.min((aoa || []).length, 20); r++) {
      var map = {}, row = aoa[r] || [];
      row.forEach(function (v, c) { var k = headKey(v); if (k && map[k] == null) map[k] = c; });
      if (map.title != null && Object.keys(map).length >= 2) return { ok: true, headerRow: r, map: map, missing: HEAD.map(function (h) { return h[0]; }).filter(function (k) { return k !== 'field' && k !== 'owner' && map[k] == null; }) };   // 업무분류 · 담당자 열은 없어도 된다(자동)
    }
    return { ok: false, error: '「주요내용」 머리글이 있는 줄을 찾지 못했습니다' };
  }
  /**
   * 시트 → 행. 원문은 그대로 둔다(앞뒤 공백도 줄바꿈도 고치지 않는다 — 셀 값 전체가 빈칸일 때만 빈 값).
   * 날짜를 읽지 못하면 date_raw 에 원문을 남기고 flag 를 단다.
   */
  function extractSheet(aoa, insp, baseYear, known) {
    var out = [], m = insp.map, cell = function (row, k) { return m[k] == null ? '' : row[m[k]]; };
    for (var r = insp.headerRow + 1; r < aoa.length; r++) {
      var row = aoa[r] || [], t = txt(cell(row, 'title')), dt = txt(cell(row, 'detail'));
      var rawW = cell(row, 'work_date'), rawD = cell(row, 'due_date');
      if (t.trim() === '' && dt.trim() === '' && txt(rawW).trim() === '' && txt(rawD).trim() === '') continue;
      var o = { row: r + 1, work_date: parseDate(rawW, baseYear), due_date: parseDate(rawD, baseYear), title: t.trim() === '' ? '' : t, detail: dt.trim() === '' ? '' : dt, flags: [] };
      if (txt(rawW).trim() !== '' && !o.work_date) { o.flags.push('날짜를 읽지 못했습니다(원문: ' + txt(rawW).trim() + ')'); o.work_raw = txt(rawW).trim(); }
      if (txt(rawD).trim() !== '' && !o.due_date) { o.flags.push('마감일을 읽지 못했습니다(원문: ' + txt(rawD).trim() + ')'); o.due_raw = txt(rawD).trim(); }
      if (o.title === '') o.flags.push('주요내용이 비어 있습니다');
      // 업무분류 — 적혀 있으면 그대로, 비었으면 자동. 모르는 값이 적혀 있으면 알리고 자동으로 돌린다
      var rawF = txt(cell(row, 'field')).trim(), nf = normField(rawF);
      if (nf) { o.field = nf === NONE ? '' : nf; o.field_src = 'file'; }
      else { var c = classify(o.title, o.detail); o.field = c.field; o.field_src = 'auto'; o.field_why = c.why; if (rawF) o.flags.push('업무분류 「' + rawF + '」는 목록에 없어 자동 분류했습니다'); }
      // 담당자(행마다) — 적혀 있으면 그대로, 비었으면 글에서 찾고, 못 찾으면 빈칸(파일 담당자가 대신 쓰인다)
      var rawO = txt(cell(row, 'owner')).trim();
      if (rawO) { o.own = rawO; o.own_src = 'file'; }
      else { var fo = findOwner(o.title, o.detail, known); o.own = fo.owner; o.own_src = fo.owner ? 'auto' : ''; o.own_why = fo.why; }
      out.push(o);
    }
    return out;
  }
  /** 파일 이름에서 담당자 후보 — 한글 2~4자 낱말 중 흔한 낱말을 뺀 마지막 것. 못 찾으면 '' (사용자가 고른다) */
  var STOP = /^(주간|업무|보고|보고서|일지|주간업무|주간업무보고|업무보고|업무일지|양식|최종|수정|수정본|취합|예제|가상|샘플|금주|차주|월|주차|팀|총무|총무팀|경영지원|경영지원팀)$/;
  function ownerFromFile(name) {
    var base = txt(name).replace(/\.[A-Za-z0-9]+$/, ''), toks = base.split(/[\s_\-.()\[\]0-9]+/).filter(Boolean), best = '';
    toks.forEach(function (t) { if (/^[가-힣]{2,4}$/.test(t) && !STOP.test(t)) best = t; });
    return best;
  }
  /** 통합문서(시트 여러 장) → 미리보기 행. 등록 전에는 아무것도 저장하지 않는다 */
  function extractBook(book, fileName, baseYear, known) {
    var sheets = [], rows = [];
    (book.names || Object.keys(book.sheets)).forEach(function (n) {
      var aoa = book.sheets[n], insp = inspectSheet(aoa);
      if (!insp.ok) { sheets.push({ sheet: n, ok: false, error: insp.error, count: 0 }); return; }
      var ex = extractSheet(aoa, insp, baseYear, known);
      sheets.push({ sheet: n, ok: true, count: ex.length, missing: insp.missing });
      ex.forEach(function (x) { x.sheet = n; rows.push(x); });
    });
    return { file: fileName, owner: ownerFromFile(fileName), sheets: sheets, rows: rows };
  }

  /* ───────────── 업무 · 상태 ───────────── */
  function blankTask(o) {
    var now = new Date().toISOString();
    return Object.assign({ id: uid(), owner: '', work_date: '', title: '', due_date: '', detail: '', field: '', status: '', needs_decision: false, decision_request: '', decision_due: '', reviewed: false, is_sample: false, source_file: '', source_sheet: '', created_at: now, updated_at: now }, o || {});
  }
  /** 상태는 진행 · 완료 · 지연 세 가지뿐. 완료가 아니고 마감일이 지났으면 지연, 그 밖은 진행(상태를 안 골랐어도 진행으로 센다) */
  function eff(t, today) { return t.status === '완료' ? '완료' : (t.due_date && t.due_date < today ? '지연' : '진행'); }
  function taskWeek(t) { return weekStart(t.work_date || t.due_date); }
  function weekTasks(tasks, w) { return tasks.filter(function (t) { return taskWeek(t) === w; }); }
  function byDue(a, b) { return (a.due_date || '9999').localeCompare(b.due_date || '9999') || (a.work_date || '').localeCompare(b.work_date || '') || a.title.localeCompare(b.title); }
  function counts(list, today) { var c = { total: list.length, '진행': 0, '완료': 0, '지연': 0 }; list.forEach(function (t) { c[eff(t, today)]++; }); return c; }
  function owners(tasks) { var s = {}; tasks.forEach(function (t) { if (t.owner) s[t.owner] = 1; }); return Object.keys(s).sort(); }
  function filter(list, f, today) {
    f = f || {};
    return list.filter(function (t) { return (!f.owner || t.owner === f.owner) && (!f.field || (t.field || '미분류') === f.field) && (!f.state || eff(t, today) === f.state) && (!f.q || norm(t.title + ' ' + t.detail + ' ' + t.owner).indexOf(norm(f.q)) >= 0); });
  }
  /** 대시보드에 올릴 것만 — 전부 나열하지 않는다 */
  function dashboard(tasks, today, showReviewed) {
    var w0 = weekStart(today), w1 = addDays(w0, 7), cur = weekTasks(tasks, w0), nxt = weekTasks(tasks, w1);
    var key = cur.filter(function (t) { return eff(t, today) !== '완료'; }).sort(function (a, b) { return (eff(b, today) === '지연') - (eff(a, today) === '지연') || (b.needs_decision && !b.reviewed ? 1 : 0) - (a.needs_decision && !a.reviewed ? 1 : 0) || byDue(a, b); }).slice(0, 6);
    return {
      week: w0, counts: counts(cur, today), key: key, next: nxt.slice().sort(byDue).slice(0, 6), nextTotal: nxt.length,
      byOwner: owners(cur).map(function (o) { return { owner: o, counts: counts(cur.filter(function (t) { return t.owner === o; }), today) }; }),
      decisions: tasks.filter(function (t) { return t.needs_decision && (showReviewed || !t.reviewed); }).sort(function (a, b) { return (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0) || (a.decision_due || '9999').localeCompare(b.decision_due || '9999'); }),
      reviewedCount: tasks.filter(function (t) { return t.needs_decision && t.reviewed; }).length
    };
  }

  /* ───────────── 중복 의심 ───────────── */
  function dupKey(t) { return norm(t.owner) + '|' + norm(t.title); }
  /** 올리려는 행마다: 이미 등록된 업무 · 같은 묶음 안의 앞 행과 「담당자 + 주요내용」이 같고 같은 주이면 중복 의심. 자동으로 빼지 않는다 */
  function markDuplicates(rows, tasks) {
    var have = {}; tasks.forEach(function (t) { (have[dupKey(t)] = have[dupKey(t)] || []).push(t); });
    var seen = {};
    rows.forEach(function (r) {
      r.dup = '';
      if (!norm(r.title)) return;
      var k = dupKey(r), w = weekStart(r.work_date || r.due_date);
      var ex = (have[k] || []).filter(function (t) { return taskWeek(t) === w; })[0];
      if (ex) r.dup = '이미 등록된 업무와 같습니다(' + (ex.work_date || '날짜 없음') + ')';
      else if (seen[k + '|' + w]) r.dup = '이번에 올린 다른 행과 같습니다(' + seen[k + '|' + w] + ')';
      else seen[k + '|' + w] = (r.file ? r.file + ' ' : '') + r.row + '행';
    });
    return rows;
  }
  /** 미리보기 행 → 업무. 업무분류는 미리보기에서 정한 값(v2.1), 상태 · 의사결정은 비워 둔다 */
  function rowsToTasks(rows) {
    return rows.filter(function (r) { return !r.skip && norm(r.title); }).map(function (r) {
      return blankTask({ owner: txt(r.owner).trim(), work_date: r.work_date || '', due_date: r.due_date || '', title: r.title, detail: r.detail || '', field: normField(r.field) === NONE ? '' : normField(r.field), source_file: r.file || '', source_sheet: r.sheet || '' });
    });
  }
  function placement(r, today) {
    var w = weekStart(r.work_date || r.due_date), w0 = weekStart(today);
    return !w ? '날짜 없음' : w === w0 ? '금주' : w === addDays(w0, 7) ? '차주' : w < w0 ? '지난 주(' + w.slice(5).replace('-', '.') + ' 주)' : '이후(' + w.slice(5).replace('-', '.') + ' 주)';
  }

  /* ───────────── 이력 · 보고서 ───────────── */
  function weeks(tasks) { var s = {}; tasks.forEach(function (t) { var w = taskWeek(t); if (w) s[w] = 1; }); return Object.keys(s).sort().reverse(); }
  function weekReport(tasks, w, today) {
    var cur = weekTasks(tasks, w).sort(byDue), nxt = weekTasks(tasks, addDays(w, 7)).sort(byDue);
    var group = function (list) { return FIELDS.concat(['미분류']).map(function (f) { return { field: f, tasks: list.filter(function (t) { return (t.field || '미분류') === f; }) }; }).filter(function (g) { return g.tasks.length || g.field !== '미분류'; }); };
    return { week: w, counts: counts(cur, today), cur: group(cur), next: group(nxt), nextTotal: nxt.length, decisions: cur.concat(nxt).filter(function (t) { return t.needs_decision && !t.reviewed; }) };
  }
  function reportSheets(tasks, w, today) {
    var rep = weekReport(tasks, w, today), head = ['구분', '업무 분야', '날짜', '주요내용', '마감일', '담당자', '진행 상태', '의사결정', '세부내용'];
    var rows = [['주간업무보고', weekLabel(w, today)], ['전체 ' + rep.counts.total, '진행 ' + rep.counts['진행'], '완료 ' + rep.counts['완료'], '지연 ' + rep.counts['지연']], [], head];
    [['금주', rep.cur], ['차주', rep.next]].forEach(function (p) { p[1].forEach(function (g) { g.tasks.forEach(function (t) { rows.push([p[0], g.field, t.work_date, t.title, t.due_date, t.owner, eff(t, today), t.needs_decision ? (t.reviewed ? '검토 완료' : '결정 필요: ' + t.decision_request) : '', t.detail]); }); }); });
    return { '주간업무보고': rows };
  }
  function templateAoa() { return [['날짜', '주요내용', '마감일', '세부내용', '업무분류', '담당자'], ['2026-11-09', '예) 임직원 건강검진 업체 선정', '2026-11-13', '예) 후보 3개 업체 견적 비교\n최종 업체 선정 필요', FIELDS[0], '']]; }
  /** 양식에 넣을 선택 목록(엑셀 데이터 유효성) — 워크시트 XML 에 끼울 조각. owners 가 있으면 담당자 칸(F)에도 넣는다(목록에 없는 이름도 적을 수 있게 오류는 띄우지 않는다) */
  function dropdownXml(col, last, owners) {
    var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;&quot;'); };
    var one = '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="업무분류" error="목록에서 골라 주세요" promptTitle="업무분류" prompt="비워 두면 올릴 때 자동으로 분류합니다" sqref="' + col + '2:' + col + (last || 500) + '"><formula1>"' + FIELDS.concat([NONE]).join(',') + '"</formula1></dataValidation>';
    var os = (owners || []).filter(function (o) { return o && !/[,"]/.test(o); }), ol = os.join(',');
    while (ol.length > 250 && os.length) { os.pop(); ol = os.join(','); }   // 엑셀의 목록 글자 수 한도(255)
    var two = os.length ? '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" promptTitle="담당자" prompt="목록에서 고르거나 직접 적습니다. 비워 두면 파일 이름 · 업무 내용에서 찾습니다" sqref="F2:F' + (last || 500) + '"><formula1>"' + esc(ol) + '"</formula1></dataValidation>' : '';
    return '<dataValidations count="' + (two ? 2 : 1) + '">' + one + two + '</dataValidations>';
  }

  /* ───────────── 샘플(가짜) — 실제 등록 데이터와 is_sample 로 구분 ───────────── */
  function sample(today) {
    var w0 = weekStart(today), R = [
      ['김민수', 0, '임직원 건강검진 업체 선정', 0, 3, '진행', '후보 3개 업체 견적 비교 완료\n최종 업체 선정 필요', 1, '업체 선정 승인 요청', 4],
      ['김민수', 0, '복지포인트 정산', 1, 2, '완료', '11월 정산 마감'],
      ['김민수', 0, '통근버스 노선 조정 안내', 0, 0, '진행', '변경 노선 공지문 작성\n협력사 회신 대기'],
      ['이지은', 1, '연말 기부금 전달식 일정 조율', 1, 4, '진행', '기관 담당자와 일정 협의 중'],
      ['이지은', 1, 'VIP 방문 의전 준비', 2, 0, '완료', '동선 및 좌석 확인'],
      ['박서준', 2, '노후 비품 실사', 0, 3, '완료', '층별 실사 완료'],
      ['박서준', 2, '사무공간 재배치안 검토', 3, 5, '진행', '2안 비교\n비용 차이 확인 필요', 1, '재배치안 선택 요청', 5],
      ['최유진', 3, '비상연락망 갱신', 0, 4, '진행', '부서별 회신 취합 중'],
      ['최유진', 3, 'BCP 훈련 시나리오 작성', 2, 6, '', '초안 작성 중'],
      ['김민수', 0, '내년 복지제도 개편안 초안', 7, 11, '', '벤치마킹 자료 수집'],
      ['이지은', 1, '연말 행사 케이터링 계약', 7, 10, '', '견적 요청 예정'],
      ['박서준', 2, '자산 재물조사 계획 수립', 8, 12, '', '', 1, '조사 범위 확정 요청', 11],
      ['최유진', 3, '비상 대피 훈련 실시', 9, 11, '', ''],
      ['정하늘', -1, '사내 게시판 공지 정리', 8, 9, '', '분야 미지정 예시']
    ];
    return R.map(function (r, i) {
      return blankTask({ id: 'sample-' + i, owner: r[0], field: r[1] < 0 ? '' : FIELDS[r[1]], title: r[2], work_date: addDays(w0, r[3]), due_date: addDays(w0, r[4]), status: r[5], detail: r[6] || '', needs_decision: !!r[7], decision_request: r[8] || '', decision_due: r[9] != null ? addDays(w0, r[9]) : '', is_sample: true });
    });
  }
  /** 저장본 읽기 — 모르는 모양이면 null. 빠진 칸은 기본값으로 채운다 */
  function fromSaved(raw) {
    var o; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
    if (!o || !Array.isArray(o.tasks)) return null;
    return { version: 2, tasks: o.tasks.map(function (t) { return blankTask(t); }), logs: Array.isArray(o.logs) ? o.logs : [] };
  }

  return {
    FIELDS: FIELDS, STATES: STATES, iso: iso, addDays: addDays, weekStart: weekStart, weekLabel: weekLabel, uid: uid, norm: norm,
    parseDate: parseDate, headKey: headKey, inspectSheet: inspectSheet, extractSheet: extractSheet, extractBook: extractBook, ownerFromFile: ownerFromFile,
    blankTask: blankTask, eff: eff, taskWeek: taskWeek, weekTasks: weekTasks, byDue: byDue, counts: counts, owners: owners, filter: filter, dashboard: dashboard,
    markDuplicates: markDuplicates, rowsToTasks: rowsToTasks, placement: placement, weeks: weeks, weekReport: weekReport, reportSheets: reportSheets,
    templateAoa: templateAoa, dropdownXml: dropdownXml, findOwner: findOwner, normField: normField, classify: classify, NONE: NONE, sample: sample, fromSaved: fromSaved
  };
});
