/* build-2611-10 (v2) · 화면 — 그리기와 저장만 한다. 추출 · 배치 · 상태 · 중복 판정은 js/weekly.js(Weekly) 에 있다. */
(function () {
  'use strict';
  var W = window.Weekly, KEY = 'build-2611-10.v2';
  var qs = new URLSearchParams(location.search);
  var TODAY = /^\d{4}-\d{2}-\d{2}$/.test(qs.get('today') || '') ? qs.get('today') : W.iso(new Date());   // ?today= 는 시험 · 시연용
  var W0 = W.weekStart(TODAY);
  var DB = null;
  var ui = { page: 'dash', open: {}, showReviewed: false, f: { owner: '', field: '', state: '' }, base: W0, form: null, up: null, tab: 'report', hweek: '', howner: '', q: '', confirm: '' };
  var $ = function (q) { return document.querySelector(q); };
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function md(s) { return s ? s.slice(5).replace('-', '.') : '-'; }
  function badge(e) { return '<span class="bd s-' + e + '">' + e + '</span>'; }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2600); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ version: 2, tasks: DB.tasks, logs: DB.logs })); return true; } catch (e) { toast('저장하지 못했습니다 — 브라우저 저장 공간을 확인해 주세요'); return false; } }
  function load() {
    DB = W.fromSaved(localStorage.getItem(KEY));
    if (!DB) { DB = { version: 2, tasks: W.sample(TODAY), logs: [] }; save(); }      // 처음 열면 샘플(가짜)로 화면을 보여 준다
  }
  function log(type, t, text) { DB.logs.unshift({ id: W.uid(), type: type, at: new Date().toISOString(), owner: t ? t.owner : '', task_id: t ? t.id : '', text: text }); if (DB.logs.length > 2000) DB.logs.length = 2000; }
  function task(id) { return DB.tasks.filter(function (t) { return t.id === id; })[0]; }
  function opts(list, cur, first) { return (first == null ? '' : '<option value="">' + h(first) + '</option>') + list.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + h(v) + '"' + (v === cur ? ' selected' : '') + '>' + h(l) + '</option>'; }).join(''); }
  function ownerList() { return W.owners(DB.tasks); }
  function sampleTag(t) { return t.is_sample ? '<i class="tagx">샘플</i>' : ''; }

  /* ───────────── 대시보드 ───────────── */
  function dash() {
    var d = W.dashboard(DB.tasks, TODAY, ui.showReviewed), c = d.counts;
    var kpi = function (l, n, k, id) { return '<div class="card kpi"><span>' + l + '</span><b id="' + id + '" class="' + (k ? 's-' + k : '') + '">' + n + '</b></div>'; };
    var mini = function (t) { return '<div class="mi"><div><b>' + h(t.title) + '</b>' + sampleTag(t) + (t.needs_decision && !t.reviewed ? '<i class="tagx dc">결정 필요</i>' : '') + '<small>' + h(t.owner || '담당자 미지정') + ' · 마감 ' + md(t.due_date) + '</small></div>' + badge(W.eff(t, TODAY)) + '</div>'; };
    return '<h2>대시보드 <small>' + h(W.weekLabel(W0, TODAY)) + ' · 오늘 ' + TODAY + '</small></h2>' +
      '<div class="kpis">' + kpi('금주 전체 업무', c.total, '', 'k-total') + kpi('진행', c['진행'], '진행', 'k-run') + kpi('완료', c['완료'], '완료', 'k-done') + kpi('지연', c['지연'], '지연', 'k-late') + '</div>' +
      '<div class="card"><h3>주요 업무 현황</h3><div class="g3">' +
      '<div id="d-key"><small>금주 중요 업무 — 지연 · 결정 필요 · 마감 임박 순</small>' + (d.key.map(mini).join('') || '<p class="em">진행 중인 업무가 없습니다</p>') + '</div>' +
      '<div id="d-next"><small>차주 예정 업무' + (d.nextTotal > d.next.length ? ' — ' + d.nextTotal + '건 중 ' + d.next.length + '건' : '') + '</small>' + (d.next.map(mini).join('') || '<p class="em">등록된 차주 업무가 없습니다</p>') + '</div>' +
      '<div id="d-owner"><small>담당자 및 진행 상태(금주)</small>' + (d.byOwner.map(function (o) { return '<div class="mi"><b>' + h(o.owner) + '</b><small><span class="s-진행">진행 ' + o.counts['진행'] + '</span> · <span class="s-완료">완료 ' + o.counts['완료'] + '</span> · <span class="s-지연">지연 ' + o.counts['지연'] + '</span></small></div>'; }).join('') || '<p class="em">없음</p>') + '</div></div>' +
      '<div class="bar" style="margin:12px 0 0"><span class="sp"></span><button class="b" data-act="go" data-p="status">주간업무 현황에서 전체 보기</button></div></div>' +
      '<div class="card"><div class="bar" style="margin:0 0 6px"><h3 style="margin:0">의사결정 필요 항목</h3><span class="sp"></span><label class="ck"><input type="checkbox" data-ch="show-reviewed"' + (ui.showReviewed ? ' checked' : '') + '> 검토 완료 항목 보기(' + d.reviewedCount + ')</label></div>' +
      (d.decisions.length ? '<div class="wrap"><table id="d-dec"><tr><th>업무 제목</th><th>담당자</th><th>요청 내용</th><th>결정 필요일</th><th></th></tr>' + d.decisions.map(function (t) { return '<tr><td><b>' + h(t.title) + '</b>' + sampleTag(t) + '</td><td>' + h(t.owner) + '</td><td>' + (h(t.decision_request) || '-') + '</td><td' + (t.decision_due && t.decision_due < TODAY && !t.reviewed ? ' class="bad"' : '') + '>' + md(t.decision_due) + '</td><td><button class="b" data-act="review" data-id="' + t.id + '">' + (t.reviewed ? '검토 취소' : '검토 완료') + '</button></td></tr>'; }).join('') + '</table></div>' : '<p class="em" id="d-dec">팀장 확인이 필요한 업무가 없습니다</p>') + '</div>';
  }

  /* ───────────── 주간업무 현황 ───────────── */
  function item(t) {
    var e = W.eff(t, TODAY), open = ui.open[t.id];
    return '<div class="item' + (open ? ' open' : '') + (e === '지연' ? ' late' : '') + '" data-id="' + t.id + '"><div class="row" data-act="toggle" data-id="' + t.id + '"><div><span class="ti">' + h(t.title) + sampleTag(t) + (t.needs_decision && !t.reviewed ? '<i class="tagx dc">결정 필요</i>' : '') + (!t.field ? '<i class="tagx un">분야 미분류</i>' : '') + '</span>' +
      '<span class="meta">날짜 ' + md(t.work_date) + ' · 마감 ' + md(t.due_date) + ' · ' + h(t.owner || '담당자 미지정') + ' · ' + h(t.field || '미분류') + '</span></div><div class="rt">' + badge(e) + '<button class="b">' + (open ? '접기' : '상세보기') + '</button></div></div>' +
      '<div class="dt"><pre class="orig">' + (h(t.detail) || '(세부내용 없음)') + '</pre>' + (t.needs_decision ? '<pre class="orig"><b>의사결정 요청</b> ' + (h(t.decision_request) || '-') + ' · 결정 필요일 ' + md(t.decision_due) + (t.reviewed ? ' · 검토 완료' : '') + '</pre>' : '') +
      '<div class="act"><label class="ck">상태 <select data-ch="set-status" data-id="' + t.id + '">' + opts([['', '진행(미지정)'], ['진행', '진행'], ['완료', '완료']], t.status) + '</select></label><label class="ck">분야 <select data-ch="set-field" data-id="' + t.id + '">' + opts(W.FIELDS, t.field, '미분류') + '</select></label>' +
      (t.source_file ? '<small>출처 ' + h(t.source_file) + (t.source_sheet ? ' / ' + h(t.source_sheet) : '') + '</small>' : '') + '<span class="sp"></span><button class="b" data-act="edit" data-id="' + t.id + '">수정</button>' +
      (ui.confirm === 'del:' + t.id ? '<button class="b dg" data-act="del" data-id="' + t.id + '">정말 삭제</button><button class="b" data-act="cancel-confirm">취소</button>' : '<button class="b dg" data-act="ask" data-key="del:' + t.id + '">삭제</button>') + '</div></div></div>';
  }
  function column(cls, title, w) {
    var all = W.weekTasks(DB.tasks, w), list = W.filter(all, ui.f, TODAY).sort(W.byDue), c = W.counts(list, TODAY);
    return '<section class="col ' + cls + '" id="col-' + cls + '"><div class="ch"><b>' + title + ' <small>' + h(W.weekLabel(w, TODAY)) + '</small></b><small>' + list.length + '건' + (list.length !== all.length ? ' / 전체 ' + all.length : '') + ' · <span class="s-진행">진행 ' + c['진행'] + '</span> · <span class="s-완료">완료 ' + c['완료'] + '</span> · <span class="s-지연">지연 ' + c['지연'] + '</span></small></div><div class="list">' + (list.map(item).join('') || '<p class="em">해당하는 업무가 없습니다</p>') + '</div></section>';
  }
  function formHtml() {
    var t = ui.form, b = function (k) { return 'data-f="' + k + '"'; };
    return '<div class="card" id="taskform"><h3>' + (t.isNew ? '업무 등록' : '업무 수정') + '</h3><div class="form">' +
      '<label>담당자 <input type="text" list="owners" ' + b('owner') + ' value="' + h(t.owner) + '"></label>' +
      '<label>날짜 <input type="date" ' + b('work_date') + ' value="' + h(t.work_date) + '"></label>' +
      '<label>마감일 <input type="date" ' + b('due_date') + ' value="' + h(t.due_date) + '"></label>' +
      '<label>업무 분야 <select ' + b('field') + '>' + opts(W.FIELDS, t.field, '미분류') + '</select></label>' +
      '<label>진행 상태 <select ' + b('status') + '>' + opts([['', '진행(미지정)'], ['진행', '진행'], ['완료', '완료']], t.status) + '</select></label>' +
      '<label class="full">주요내용 <input type="text" ' + b('title') + ' value="' + h(t.title) + '"></label>' +
      '<label class="full">세부내용 <textarea ' + b('detail') + '>' + h(t.detail) + '</textarea></label>' +
      '<label class="ck" style="flex-direction:row"><input type="checkbox" ' + b('needs_decision') + (t.needs_decision ? ' checked' : '') + '> 팀장 의사결정 필요</label>' +
      '<label>요청 내용 <input type="text" ' + b('decision_request') + ' value="' + h(t.decision_request) + '"></label>' +
      '<label>결정 필요일 <input type="date" ' + b('decision_due') + ' value="' + h(t.decision_due) + '"></label></div>' +
      '<datalist id="owners">' + ownerList().map(function (o) { return '<option value="' + h(o) + '">'; }).join('') + '</datalist>' +
      '<div class="bar" style="margin:12px 0 0"><span class="sp"></span><button class="b" data-act="form-cancel">취소</button><button class="b pri" data-act="form-save">저장</button></div></div>';
  }
  function status() {
    var w = ui.base, isNow = w === W0;
    return '<h2>주간업무 현황</h2><div class="bar noprint"><select data-ch="f-owner">' + opts(ownerList(), ui.f.owner, '담당자 전체') + '</select><select data-ch="f-field">' + opts(W.FIELDS.concat(['미분류']), ui.f.field, '분야 전체') + '</select><select data-ch="f-state">' + opts(W.STATES, ui.f.state, '상태 전체') + '</select>' +
      '<span class="sp"></span><button class="b" data-act="week" data-d="-7">◀ 이전 주</button><button class="b" data-act="week" data-d="0"' + (isNow ? ' disabled' : '') + '>이번 주로</button><button class="b" data-act="week" data-d="7">다음 주 ▶</button><button class="b pri" data-act="new">업무 등록</button></div>' +
      (ui.form ? formHtml() : '') +
      '<div class="cols">' + column('cur', isNow ? '금주 업무' : '기준 주', w) + column('nxt', isNow ? '차주 업무' : '그다음 주', W.addDays(w, 7)) + '</div>';
  }

  /* ───────────── 엑셀 업로드 ───────────── */
  function upload() {
    var u = ui.up, step = !u ? 1 : u.done ? 4 : 3;
    var st = function (n, l) { return '<div class="step' + (step === n ? ' on' : step > n ? ' done' : '') + '"><b>STEP 0' + n + '</b>' + l + '</div>'; };
    var out = '<h2>엑셀 업로드</h2><div class="steps">' + st(1, '파일 업로드') + st(2, '4개 항목 자동 추출') + st(3, '미리보기 및 수정') + st(4, '최종 등록') + '</div>';
    if (!u) return out + '<div class="card"><label class="drop" id="drop" data-act="pick"><b>팀원들의 엑셀 주간업무보고를 끌어다 놓거나 눌러서 고르세요</b><span class="sub">XLSX · XLS · 여러 파일을 한 번에 올릴 수 있습니다 · 파일은 서버로 올라가지 않습니다</span></label>' +
      '<div class="bar" style="margin:12px 0 0"><button class="b" data-act="tpl">엑셀 양식 내려받기</button><button class="b" data-act="tpl-sample">예제 엑셀 3개 내려받기(가짜)</button></div></div>' +
      '<div class="card"><h3>추출하는 항목</h3><div class="wrap"><table><tr><th>엑셀 머리글</th><th>시스템 항목</th><th>비고</th></tr><tr><td>날짜</td><td>업무 날짜</td><td>이 날짜가 속한 주로 금주 · 차주에 배치합니다</td></tr><tr><td>주요내용</td><td>업무 제목</td><td>원문 그대로</td></tr><tr><td>마감일</td><td>완료 예정일</td><td>지나면 지연으로 표시</td></tr><tr><td>세부내용</td><td>업무 상세 내용</td><td>줄바꿈 · 문단 그대로</td></tr></table></div>' +
      '<p class="sub" style="margin:10px 0 0">열 순서가 달라도 머리글로 찾습니다. 시트가 여러 장이면 시트마다 읽습니다. <b>담당자</b> 열이 있으면 그 값을 쓰고, 비어 있으면 업무 내용(「담당: 홍길동」처럼 적힌 이름 · 등록된 담당자 이름)에서 찾고, 그래도 없으면 파일 이름의 담당자를 씁니다. 이름을 지어내지는 않습니다. <b>업무분류</b> 열이 있으면 그 값을 쓰고, 비어 있으면 제목 · 세부내용의 낱말로 자동 분류합니다(맞는 낱말이 없으면 미분류). 미리보기에서 고칠 수 있습니다. 진행 상태 · 의사결정 여부는 등록 뒤 「주간업무 현황」에서 지정합니다.</p></div>';
    if (u.done) return out + '<div class="okb" id="up-done"><b>' + u.done.n + '건을 등록했습니다.</b> 금주 ' + u.done.cur + '건 · 차주 ' + u.done.nxt + '건 · 그 밖의 주 ' + u.done.etc + '건. 분야와 진행 상태는 「주간업무 현황」에서 지정해 주세요.</div><div class="bar"><button class="b pri" data-act="go" data-p="status">주간업무 현황 보기</button><button class="b" data-act="up-reset">다른 파일 올리기</button></div>';
    var rows = [].concat.apply([], u.files.map(function (f) { return f.rows; })), okN = rows.filter(function (r) { return !r.skip && W.norm(r.title); }).length, dupN = rows.filter(function (r) { return r.dup; }).length, noOwner = u.files.filter(function (f) { return !f.owner.trim() && f.rows.some(function (r) { return !r.skip && !(r.own || '').trim(); }); });
    out += '<div class="card"><h3>올린 파일 ' + u.files.length + '개 <small>담당자를 확인해 주세요</small></h3><div class="wrap"><table id="up-files"><tr><th>파일</th><th>담당자</th><th>시트</th><th>추출</th></tr>' + u.files.map(function (f, i) {
      return '<tr><td>' + h(f.file) + '</td><td><input type="text" list="owners" data-ch="up-owner" data-i="' + i + '" value="' + h(f.owner) + '" placeholder="담당자 이름"' + (f.owner.trim() ? '' : ' style="border-color:var(--red)"') + '></td><td>' + f.sheets.map(function (s) { return h(s.sheet) + (s.ok ? ' ' + s.count + '건' + (s.missing.length ? ' <span class="bad">(없는 열: ' + s.missing.map(function (k) { return { work_date: '날짜', due_date: '마감일', detail: '세부내용' }[k]; }).join(', ') + ')</span>' : '') : ' <span class="bad">— ' + h(s.error) + '</span>'); }).join('<br>') + '</td><td>' + f.rows.length + '건</td></tr>';
    }).join('') + '</table></div><datalist id="owners">' + ownerList().map(function (o) { return '<option value="' + h(o) + '">'; }).join('') + '</datalist></div>';
    if (dupN) out += '<div class="warnb" id="up-dup"><b>중복 의심 ' + dupN + '건</b> — 담당자와 주요내용이 같은 주에 이미 있습니다. 기본으로 「등록 안 함」에 두었습니다. 따로 등록해야 하면 체크를 풀어 주세요.</div>';
    out += '<div class="card"><h3>추출 데이터 미리보기 <small>등록 전에는 실제 업무에 반영되지 않습니다 · 원문은 그대로이며 여기서 고칠 수 있습니다</small></h3><div class="wrap"><table class="prev" id="up-prev"><tr><th>등록 안 함</th><th>담당자</th><th>날짜</th><th>주요내용</th><th>마감일</th><th>세부내용</th><th>업무분류</th><th>배치</th><th>확인</th></tr>' + (u.files.map(function (f, i) {
      return f.rows.map(function (r, j) {
        var k = 'data-i="' + i + '" data-j="' + j + '"';
        return '<tr class="' + (r.skip ? 'skip' : '') + (r.flags.length || r.dup ? ' flag' : '') + '"><td><input type="checkbox" data-ch="up-skip" ' + k + (r.skip ? ' checked' : '') + '></td><td><input type="text" list="owners" class="own" data-ch="up-cell" data-k="own" ' + k + ' value="' + h(r.own || '') + '" placeholder="' + h(f.owner || '담당자') + '"><small class="auto">' + (r.own_src === 'file' ? '엑셀 값' : r.own_src === 'auto' ? '자동 · ' + h(r.own_why || '') : r.own_src === 'manual' ? '직접 고름' : (f.owner ? '파일 담당자 ' + h(f.owner) : '<span class="bad">미지정</span>')) + '</small></td><td><input type="date" data-ch="up-cell" data-k="work_date" ' + k + ' value="' + h(r.work_date) + '"></td><td><input type="text" data-ch="up-cell" data-k="title" ' + k + ' value="' + h(r.title) + '"></td><td><input type="date" data-ch="up-cell" data-k="due_date" ' + k + ' value="' + h(r.due_date) + '"></td><td><textarea data-ch="up-cell" data-k="detail" ' + k + '>' + h(r.detail) + '</textarea></td><td><select data-ch="up-cell" data-k="field" ' + k + '>' + opts(W.FIELDS, r.field || '', W.NONE) + '</select>' + (r.field_src === 'auto' ? '<small class="auto" title="' + h((r.field_why || []).join(', ')) + '">' + (r.field ? '자동 · ' + h((r.field_why || []).slice(0, 3).join(', ')) : '자동 분류 못 함') + '</small>' : r.field_src === 'file' ? '<small class="auto">엑셀 값</small>' : '<small class="auto">직접 고름</small>') + '</td><td>' + h(W.placement(r, TODAY)) + '</td><td>' + (r.dup ? '<span class="bad">중복 의심</span> ' + h(r.dup) + '<br>' : '') + r.flags.map(function (x) { return '<span class="bad">' + h(x) + '</span>'; }).join('<br>') + '<small>' + h(r.sheet) + ' ' + r.row + '행</small></td></tr>';
      }).join('');
    }).join('') || '<tr><td colspan="8" class="em">추출된 행이 없습니다 — 머리글(날짜 · 주요내용 · 마감일 · 세부내용)을 확인해 주세요</td></tr>') + '</table></div>' +
      (noOwner.length ? '<p class="bad" id="up-noowner" style="margin:10px 0 0">담당자가 비어 있는 파일이 있습니다: ' + noOwner.map(function (f) { return h(f.file); }).join(', ') + '</p>' : '') +
      '<div class="bar" style="margin:12px 0 0"><span class="sp"></span><button class="b" data-act="up-reset">취소</button><button class="b pri" data-act="up-commit"' + (okN && !noOwner.length ? '' : ' disabled') + '>최종 등록(' + okN + '건)</button></div></div>';
    return out;
  }
  function readFiles(files) {
    var list = [].slice.call(files).filter(function (f) { return /\.(xlsx|xls)$/i.test(f.name); });
    if (!list.length) return toast('XLSX · XLS 파일을 골라 주세요');
    Promise.all(list.map(function (f) {
      return new Promise(function (res) {
        var r = new FileReader();
        r.onload = function () { try { var wb = XLSX.read(r.result, { type: 'array' }), sheets = {}; wb.SheetNames.forEach(function (n) { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); }); res(W.extractBook({ names: wb.SheetNames, sheets: sheets }, f.name, +TODAY.slice(0, 4), ownerList())); } catch (e) { res({ file: f.name, owner: '', sheets: [{ sheet: '-', ok: false, error: '엑셀을 읽지 못했습니다(' + e.message + ')', count: 0 }], rows: [] }); } };
        r.onerror = function () { res({ file: f.name, owner: '', sheets: [{ sheet: '-', ok: false, error: '파일을 읽지 못했습니다', count: 0 }], rows: [] }); };
        r.readAsArrayBuffer(f);
      });
    })).then(function (ex) { ui.up = { files: ex }; remark(true); render(); });
  }
  /** 중복 의심 다시 계산. first 면 중복 행을 기본 「등록 안 함」으로 */
  function remark(first) {
    var all = []; ui.up.files.forEach(function (f) { f.rows.forEach(function (r) { r.owner = (r.own || '').trim() || f.owner; r.file = f.file; all.push(r); }); });   // 행의 담당자(엑셀 · 자동 · 직접)가 있으면 그것, 없으면 파일 담당자
    var active = all.filter(function (r) { return first || !r.skip || r.dup; });
    W.markDuplicates(active, DB.tasks);
    all.forEach(function (r) { if (active.indexOf(r) < 0) r.dup = ''; if (first) r.skip = !!r.dup || !W.norm(r.title); });
  }

  /* ───────────── 보고서 및 이력 ───────────── */
  function hist() {
    var wk = W.weeks(DB.tasks); if (wk.indexOf(W0) < 0) wk.unshift(W0); wk.sort().reverse();
    if (!ui.hweek || wk.indexOf(ui.hweek) < 0) ui.hweek = W0;
    var tab = function (k, l) { return '<button class="b' + (ui.tab === k ? ' on' : '') + '" data-act="tab" data-k="' + k + '">' + l + '</button>'; };
    var out = '<h2>보고서 및 이력</h2><div class="tabs noprint">' + tab('report', '주차별 보고서') + tab('owner', '담당자별 업무 이력') + tab('status', '상태 변경 이력') + tab('upload', '엑셀 업로드 이력') + '<span class="sp"></span><input type="search" data-ch="h-q" placeholder="검색(업무 · 담당자 · 내용)" value="' + h(ui.q) + '"></div>';
    var when = function (s) { return h(s.replace('T', ' ').slice(0, 16)); };
    if (ui.tab === 'report') {
      var rep = W.weekReport(W.filter(DB.tasks, { q: ui.q }, TODAY), ui.hweek, TODAY), c = rep.counts;
      var rowsOf = function (groups) { return groups.map(function (g) { return '<tr class="fieldhead"><td colspan="6">' + h(g.field) + ' <small>' + g.tasks.length + '건</small></td></tr>' + (g.tasks.map(function (t) { return '<tr><td>' + md(t.work_date) + '</td><td><b>' + h(t.title) + '</b>' + sampleTag(t) + (t.needs_decision && !t.reviewed ? '<i class="tagx dc">결정 필요</i>' : '') + (t.detail ? '<pre class="orig" style="margin:5px 0 0">' + h(t.detail) + '</pre>' : '') + '</td><td>' + md(t.due_date) + '</td><td>' + h(t.owner) + '</td><td>' + badge(W.eff(t, TODAY)) + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="sub">해당 기간 업무 없음</td></tr>'); }).join(''); };
      var head = '<tr><th>날짜</th><th>주요내용</th><th>마감일</th><th>담당자</th><th>상태</th></tr>';
      out += '<div class="bar noprint"><label class="ck">주차 <select data-ch="h-week">' + opts(wk.map(function (w) { return [w, W.weekLabel(w, TODAY)]; }), ui.hweek) + '</select></label><span class="sp"></span><button class="b" data-act="print">인쇄 · PDF 저장</button><button class="b" data-act="xlsx">엑셀로 내려받기</button></div>' +
        '<div class="card" id="h-report"><h3>주간업무보고 — ' + h(W.weekLabel(ui.hweek, TODAY)) + '</h3><p>전체 <b>' + c.total + '</b>건 · <span class="s-진행">진행 ' + c['진행'] + '</span> · <span class="s-완료">완료 ' + c['완료'] + '</span> · <span class="s-지연">지연 ' + c['지연'] + '</span> · 그다음 주 예정 ' + rep.nextTotal + '건 · 결정 필요 ' + rep.decisions.length + '건</p>' +
        '<h3>이번 주 업무</h3><div class="wrap"><table>' + head + rowsOf(rep.cur) + '</table></div><h3 style="margin-top:16px">그다음 주 업무</h3><div class="wrap"><table>' + head + rowsOf(rep.next) + '</table></div></div>';
    } else if (ui.tab === 'owner') {
      var os = ownerList(); if (os.indexOf(ui.howner) < 0) ui.howner = os[0] || '';
      var mine = W.filter(DB.tasks, { owner: ui.howner, q: ui.q }, TODAY).sort(function (a, b) { return (b.work_date || b.due_date || '').localeCompare(a.work_date || a.due_date || ''); });
      out += '<div class="bar"><label class="ck">담당자 <select data-ch="h-owner">' + opts(os, ui.howner) + '</select></label><small>' + mine.length + '건</small></div><div class="card"><div class="wrap"><table id="h-owner"><tr><th>주차</th><th>날짜</th><th>주요내용</th><th>마감일</th><th>분야</th><th>상태</th></tr>' + (mine.map(function (t) { return '<tr><td>' + h(W.weekLabel(W.taskWeek(t), TODAY)) + '</td><td>' + md(t.work_date) + '</td><td><b>' + h(t.title) + '</b>' + sampleTag(t) + '</td><td>' + md(t.due_date) + '</td><td>' + h(t.field || '미분류') + '</td><td>' + badge(W.eff(t, TODAY)) + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="em">업무가 없습니다</td></tr>') + '</table></div></div>';
    } else {
      var type = ui.tab === 'status' ? ['status', 'edit', 'delete'] : ['upload'], q = W.norm(ui.q);
      var logs = DB.logs.filter(function (l) { return type.indexOf(l.type) >= 0 && (!q || W.norm(l.text + ' ' + l.owner).indexOf(q) >= 0); });
      out += '<div class="card"><div class="wrap"><table id="h-logs"><tr><th>일시</th><th>' + (ui.tab === 'status' ? '담당자' : '파일') + '</th><th>내용</th></tr>' + (logs.slice(0, 300).map(function (l) { return '<tr><td style="white-space:nowrap">' + when(l.at) + '</td><td>' + h(l.owner) + '</td><td>' + h(l.text) + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="em">' + (ui.tab === 'status' ? '상태 · 수정 · 삭제 이력이 없습니다' : '엑셀 업로드 이력이 없습니다') + '</td></tr>') + '</table></div></div>';
    }
    return out + '<div class="card noprint"><h3>자료 보관</h3><p class="sub">자료는 이 브라우저에만 저장됩니다. 다른 PC 로 옮기거나 보관하려면 백업을 내려받으세요.</p><div class="bar" style="margin:0"><button class="b" data-act="backup">백업 내려받기(JSON)</button><button class="b" data-act="restore">백업 불러오기</button>' + (ui.confirm === 'wipe' ? '<button class="b dg" data-act="wipe">정말 전체 삭제</button><button class="b" data-act="cancel-confirm">취소</button>' : '<button class="b dg" data-act="ask" data-key="wipe">전체 삭제</button>') + '</div></div>';
  }

  /* ───────────── 그리기 ───────────── */
  var pages = { dash: dash, status: status, upload: upload, hist: hist };
  function render() {
    var v = $('#view'), sc = [].map.call(v.querySelectorAll('.list'), function (l) { return l.scrollTop; }), top = v.scrollTop;
    v.innerHTML = pages[ui.page]();
    [].forEach.call(v.querySelectorAll('.list'), function (l, i) { l.scrollTop = sc[i] || 0; }); v.scrollTop = top;
    [].forEach.call(document.querySelectorAll('#nav button'), function (b) { b.classList.toggle('on', b.dataset.p === ui.page); });
    $('#sb-sample').hidden = !DB.tasks.some(function (t) { return t.is_sample; });
    document.body.dataset.page = ui.page;
  }
  function go(p) { ui.page = p; ui.confirm = ''; if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p); render(); $('#view').scrollTop = 0; }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function pick(accept, multi, cb) { var f = $('#fileany'); f.value = ''; f.accept = accept; f.multiple = !!multi; f.onchange = function () { if (f.files.length) cb(f.files); }; f.click(); }
  function wbOf(aoa, name) { var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name || '주간업무'); return wb; }

  var acts = {
    go: function (el) { go(el.dataset.p); },
    ask: function (el) { ui.confirm = el.dataset.key; render(); },
    'cancel-confirm': function () { ui.confirm = ''; render(); },
    'clear-sample': function () { var n = DB.tasks.filter(function (t) { return t.is_sample; }).length; DB.tasks = DB.tasks.filter(function (t) { return !t.is_sample; }); save(); toast('샘플 ' + n + '건을 지웠습니다. 실제 등록한 업무는 그대로입니다'); render(); },
    review: function (el) { var t = task(el.dataset.id); t.reviewed = !t.reviewed; t.updated_at = new Date().toISOString(); log('status', t, '「' + t.title + '」 의사결정 ' + (t.reviewed ? '검토 완료' : '검토 취소')); save(); render(); },
    toggle: function (el, e) { if (e.target.closest('select,input,textarea')) return; ui.open[el.dataset.id] = !ui.open[el.dataset.id]; render(); },
    week: function (el) { ui.base = el.dataset.d === '0' ? W0 : W.addDays(ui.base, +el.dataset.d); render(); },
    'new': function () { ui.form = W.blankTask({ work_date: TODAY, isNew: true }); render(); $('#view').scrollTop = 0; },
    edit: function (el) { ui.form = Object.assign({}, task(el.dataset.id)); render(); $('#view').scrollTop = 0; },
    'form-cancel': function () { ui.form = null; render(); },
    'form-save': function () {
      var f = ui.form; [].forEach.call(document.querySelectorAll('#taskform [data-f]'), function (el) { f[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
      f.owner = f.owner.trim();
      if (!f.title.trim()) return toast('주요내용을 넣어 주세요');
      if (!f.work_date && !f.due_date) return toast('날짜나 마감일 중 하나는 있어야 금주 · 차주에 배치됩니다');
      if (!f.needs_decision) { f.decision_request = ''; f.decision_due = ''; f.reviewed = false; }
      var dup = DB.tasks.filter(function (t) { return t.id !== f.id && W.norm(t.owner) === W.norm(f.owner) && W.norm(t.title) === W.norm(f.title) && W.taskWeek(t) === W.taskWeek(f); })[0];
      if (dup && ui.confirm !== 'dupsave') { ui.confirm = 'dupsave'; return toast('같은 주에 담당자 · 주요내용이 같은 업무가 있습니다. 그래도 저장하려면 「저장」을 한 번 더 누르세요'); }
      ui.confirm = ''; f.updated_at = new Date().toISOString();
      if (f.isNew) { delete f.isNew; f.is_sample = false; DB.tasks.push(f); log('edit', f, '「' + f.title + '」 등록'); }
      else { var old = task(f.id), i = DB.tasks.indexOf(old); if (old.status !== f.status) log('status', f, '「' + f.title + '」 상태 ' + (old.status || '진행(미지정)') + ' → ' + (f.status || '진행(미지정)')); else log('edit', f, '「' + f.title + '」 수정'); DB.tasks[i] = f; }
      ui.form = null; save(); toast('저장했습니다'); render();
    },
    del: function (el) { var t = task(el.dataset.id); DB.tasks = DB.tasks.filter(function (x) { return x.id !== t.id; }); log('delete', t, '「' + t.title + '」 삭제'); ui.confirm = ''; save(); toast('삭제했습니다'); render(); },
    pick: function () { pick('.xlsx,.xls', true, readFiles); },
    tpl: function () {   // 업무분류 칸에 선택 목록을 넣는다 — SheetJS 는 데이터 유효성을 쓰지 못해 만든 파일의 시트 XML 에 끼운다
      var wb = wbOf(W.templateAoa()); wb.Sheets[wb.SheetNames[0]]['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 12 }, { wch: 44 }, { wch: 18 }, { wch: 12 }];
      var data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), out = data;
      try {
        var z = XLSX.CFB.read(new Uint8Array(data), { type: 'array' }), ix = -1; z.FullPaths.forEach(function (p, i) { if (/xl\/worksheets\/sheet1\.xml$/.test(p)) ix = i; });
        var fe = z.FileIndex[ix], xml = new TextDecoder().decode(new Uint8Array(fe.content));
        if (xml.indexOf('</sheetData>') < 0) throw new Error('sheetData 없음');
        var bytes = new TextEncoder().encode(xml.replace('</sheetData>', '</sheetData>' + W.dropdownXml('E', 500, ownerList())));
        fe.content = bytes; fe.size = bytes.length; out = XLSX.CFB.write(z, { type: 'array', fileType: 'zip' });
      } catch (err) { out = data; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = '주간업무보고_양식.xlsx'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    'tpl-sample': function () {
      var s = W.sample(TODAY), by = {}; s.forEach(function (t) { (by[t.owner] = by[t.owner] || []).push(t); });
      Object.keys(by).slice(0, 3).forEach(function (o, i) { setTimeout(function () { XLSX.writeFile(wbOf([['날짜', '주요내용', '마감일', '세부내용']].concat(by[o].map(function (t) { return [t.work_date, t.title + ' (예제)', t.due_date, t.detail]; }))), '주간업무보고_' + o + '.xlsx'); }, i * 400); });
    },
    'up-reset': function () { ui.up = null; render(); },
    'up-commit': function () {
      var u = ui.up, n = 0, cur = 0, nxt = 0;
      u.files.forEach(function (f) {
        var rows = f.rows.filter(function (r) { return !r.skip && W.norm(r.title); }); if (!rows.length) return;
        rows.forEach(function (r) { r.owner = (r.own || '').trim() || f.owner; r.file = f.file; });   // 행의 담당자가 우선(v2.2)
        var ts = W.rowsToTasks(rows); ts.forEach(function (t) { DB.tasks.push(t); var w = W.taskWeek(t); if (w === W0) cur++; else if (w === W.addDays(W0, 7)) nxt++; });
        n += ts.length;
        DB.logs.unshift({ id: W.uid(), type: 'upload', at: new Date().toISOString(), owner: f.file, task_id: '', text: (f.owner || ts.map(function (t) { return t.owner; }).filter(function (x, i, arr) { return x && arr.indexOf(x) === i; }).join(', ') || '담당자 미지정') + ' · ' + ts.length + '건 등록' + (f.rows.length - ts.length ? ' · ' + (f.rows.length - ts.length) + '건 제외' : '') + ' · 시트 ' + f.sheets.filter(function (s) { return s.ok; }).map(function (s) { return s.sheet; }).join(', ') });
      });
      if (!save()) return;
      ui.up = { files: [], done: { n: n, cur: cur, nxt: nxt, etc: n - cur - nxt } }; render();
    },
    tab: function (el) { ui.tab = el.dataset.k; render(); },
    print: function () { window.print(); },
    xlsx: function () { var sh = W.reportSheets(DB.tasks, ui.hweek, TODAY), wb = XLSX.utils.book_new(); Object.keys(sh).forEach(function (n) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh[n]), n); }); XLSX.writeFile(wb, '주간업무보고_' + ui.hweek + '.xlsx'); },
    backup: function () { download(new Blob([JSON.stringify({ version: 2, exported_at: new Date().toISOString(), tasks: DB.tasks, logs: DB.logs })], { type: 'application/json' }), '주간업무보고_백업_' + TODAY + '.json'); },
    restore: function () { pick('.json,application/json', false, function (fs) { fs[0].text().then(function (t) { var o = W.fromSaved(t); if (!o) return toast('백업 파일 모양이 아닙니다'); DB = o; save(); toast('백업을 불러왔습니다(업무 ' + DB.tasks.length + '건)'); render(); }); }); },
    wipe: function () { DB = { version: 2, tasks: [], logs: [] }; ui.confirm = ''; save(); toast('모든 업무와 이력을 지웠습니다'); render(); }
  };
  var changes = {
    'show-reviewed': function (el) { ui.showReviewed = el.checked; render(); },
    'f-owner': function (el) { ui.f.owner = el.value; render(); }, 'f-field': function (el) { ui.f.field = el.value; render(); }, 'f-state': function (el) { ui.f.state = el.value; render(); },
    'set-status': function (el) { var t = task(el.dataset.id), old = t.status; t.status = el.value; t.updated_at = new Date().toISOString(); log('status', t, '「' + t.title + '」 상태 ' + (old || '진행(미지정)') + ' → ' + (t.status || '진행(미지정)')); save(); render(); },
    'set-field': function (el) { var t = task(el.dataset.id); t.field = el.value; t.updated_at = new Date().toISOString(); log('edit', t, '「' + t.title + '」 분야 → ' + (t.field || '미분류')); save(); render(); },
    'up-owner': function (el) { ui.up.files[+el.dataset.i].owner = el.value.trim(); remark(false); render(); },
    'up-skip': function (el) { ui.up.files[+el.dataset.i].rows[+el.dataset.j].skip = el.checked; render(); },
    'up-cell': function (el) { var r = ui.up.files[+el.dataset.i].rows[+el.dataset.j]; r[el.dataset.k] = el.value; if (el.dataset.k === 'field') { r.field_src = 'manual'; return render(); } if (el.dataset.k === 'own') { r.own = el.value.trim(); r.own_src = r.own ? 'manual' : ''; remark(false); return render(); } if (el.dataset.k !== 'detail') { r.flags = r.flags.filter(function (x) { return el.dataset.k === 'work_date' ? !/^날짜를/.test(x) : el.dataset.k === 'due_date' ? !/^마감일을/.test(x) : !/^주요내용이/.test(x); }); if (el.dataset.k === 'title' && !W.norm(r.title)) r.flags.push('주요내용이 비어 있습니다'); remark(false); render(); } },
    'h-week': function (el) { ui.hweek = el.value; render(); }, 'h-owner': function (el) { ui.howner = el.value; render(); },
    'h-q': function (el) { ui.q = el.value; render(); var q = document.querySelector('[data-ch="h-q"]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  };
  document.addEventListener('click', function (e) {
    var nb = e.target.closest('#nav button'); if (nb) return go(nb.dataset.p);
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    if (el.tagName === 'LABEL') e.preventDefault();
    if (acts[el.dataset.act]) acts[el.dataset.act](el, e);
  });
  document.addEventListener('change', function (e) { var k = e.target.dataset.ch; if (k && changes[k]) changes[k](e.target); });
  document.addEventListener('dragover', function (e) { if (ui.page === 'upload' && !ui.up) { e.preventDefault(); var d = $('#drop'); if (d) d.classList.add('over'); } });
  document.addEventListener('drop', function (e) { if (ui.page === 'upload' && !ui.up) { e.preventDefault(); readFiles(e.dataTransfer.files); } });

  load();
  var p0 = location.hash.slice(1); if (pages[p0]) ui.page = p0;
  window.__app = { db: function () { return DB; }, today: TODAY, save: function () { save(); } };
  render();
})();
