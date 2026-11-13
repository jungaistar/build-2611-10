/* 규칙 고정 — node test/logic.test.js */
'use strict';
var W = require('../js/weekly.js');
var passed = 0, failed = 0;
function ok(c, label, d) { if (c) passed++; else { failed++; console.log('  X ' + label + (d != null ? '\n      ' + d : '')); } }
function eq(g, w, label) { ok(JSON.stringify(g) === JSON.stringify(w), label, '기대: ' + JSON.stringify(w) + '  실제: ' + JSON.stringify(g)); }
var T = '2026-11-12';   // 목요일

/* 주 계산 */
eq([W.weekStart('2026-11-12'), W.weekStart('2026-11-09'), W.weekStart('2026-11-15'), W.weekStart('2026-11-16'), W.weekStart(''), W.weekStart('x')], ['2026-11-09', '2026-11-09', '2026-11-09', '2026-11-16', '', ''], '주의 시작은 월요일');
eq([W.addDays('2026-11-30', 1), W.addDays('2026-12-31', 1), W.addDays('2026-03-01', -1)], ['2026-12-01', '2027-01-01', '2026-02-28'], '날짜 더하기(달 · 해 넘김)');
ok(/\(금주\)/.test(W.weekLabel('2026-11-09', T)) && /\(차주\)/.test(W.weekLabel('2026-11-16', T)) && /\(전주\)/.test(W.weekLabel('2026-11-02', T)) && !/\(/.test(W.weekLabel('2026-10-05', T)), '주 이름표');

/* 날짜 읽기 */
eq([W.parseDate(46338), W.parseDate('2026-11-09'), W.parseDate('2026.11.9'), W.parseDate('2026/11/09'), W.parseDate('2026년 11월 9일'), W.parseDate('20261109'), W.parseDate('26.11.9'), W.parseDate('11/13', 2026), W.parseDate('11월 3일(화)', 2026), W.parseDate(new Date(2026, 10, 9))],
  ['2026-11-12', '2026-11-09', '2026-11-09', '2026-11-09', '2026-11-09', '2026-11-09', '2026-11-09', '2026-11-13', '2026-11-03', '2026-11-09'], '날짜 모양 여러 가지(엑셀 날짜 숫자 포함)');
eq([W.parseDate(''), W.parseDate(null), W.parseDate('미정'), W.parseDate('2026-02-30'), W.parseDate('13/45', 2026), W.parseDate(5)], ['', '', '', '', '', ''], '읽지 못하는 날짜는 빈 값(지어내지 않는다)');

/* 머리글 · 추출 */
eq(['날짜', '주요내용', '마감일', '세부내용', ' 주요 내용 ', '완료예정일', '업무명', '비고', '담당', ''].map(W.headKey), ['work_date', 'title', 'due_date', 'detail', 'title', 'due_date', 'title', 'detail', 'owner', ''], '머리글로 항목 식별(v2.2 — 「담당」은 담당자 열)');
var aoa = [['주간업무보고'], [], ['세부내용', '마감일', '번호', '주요내용', '날짜'],
  ['1안 검토\n  2안 검토\n\n비용 확인 ', '2026-11-13', 1, ' 건강검진 업체 선정 ', '2026-11-09'], ['', '', 2, '복지포인트 정산', 46336], ['메모만', '', 3, '', ''], ['', '', '', '', ''], ['', '미정', 4, '날짜 이상', '어제']];
var insp = W.inspectSheet(aoa);
ok(insp.ok && insp.headerRow === 2 && insp.missing.length === 0, '머리줄을 3행에서 찾는다');
eq(insp.map, { detail: 0, due_date: 1, title: 3, work_date: 4 }, '열 순서가 달라도 찾는다');
var ex = W.extractSheet(aoa, insp, 2026);
eq(ex.length, 4, '빈 줄은 건너뛴다(4행)');
eq([ex[0].title, ex[0].detail, ex[0].work_date, ex[0].due_date], [' 건강검진 업체 선정 ', '1안 검토\n  2안 검토\n\n비용 확인 ', '2026-11-09', '2026-11-13'], '원문 그대로 — 줄바꿈 · 문단 · 공백을 고치지 않는다');
eq([ex[1].detail, ex[1].due_date, ex[1].work_date], ['', '', '2026-11-10'], '빈 셀은 빈 값, 엑셀 날짜 숫자');
ok(ex[2].title === '' && /주요내용이 비어/.test(ex[2].flags.join()), '주요내용이 빈 행은 알린다');
ok(ex[3].work_date === '' && ex[3].work_raw === '어제' && /날짜를 읽지 못했습니다\(원문: 어제\)/.test(ex[3].flags[0]) && /마감일을 읽지 못했습니다\(원문: 미정\)/.test(ex[3].flags[1]), '읽지 못한 날짜는 원문을 남기고 알린다');
ok(!W.inspectSheet([['a', 'b'], [1, 2]]).ok && !W.inspectSheet([['주요내용'], ['x']]).ok, '머리글이 없거나 하나뿐이면 읽지 않는다');
eq(W.inspectSheet([['주요내용', '날짜'], ['x', '2026-11-09']]).missing, ['due_date', 'detail'], '없는 열을 알려 준다');
eq(['주간업무보고_김민수_11월2주.xlsx', '이지은 주간업무.xls', '주간업무보고(박서준).xlsx', 'weekly.xlsx', '총무팀_주간업무보고.xlsx'].map(W.ownerFromFile), ['김민수', '이지은', '박서준', '', ''], '파일 이름에서 담당자 후보(없으면 비움)');
var bk = W.extractBook({ names: ['1주', '메모', '2주'], sheets: { '1주': aoa, '메모': [['아무']], '2주': [['날짜', '주요내용'], ['2026-11-16', '차주 일']] } }, '주간업무보고_김민수.xlsx', 2026);
eq([bk.owner, bk.rows.length, bk.sheets.map(function (s) { return s.sheet + ':' + s.ok + ':' + s.count; }), bk.rows[4].sheet], ['김민수', 5, ['1주:true:4', '메모:false:0', '2주:true:1'], '2주'], '시트 여러 장을 시트별로');

/* 상태 · 배치 · 집계 */
var t = function (o) { return W.blankTask(o); };
eq([W.eff(t({ status: '완료', due_date: '2026-11-01' }), T), W.eff(t({ due_date: '2026-11-11' }), T), W.eff(t({ due_date: '2026-11-12' }), T), W.eff(t({ status: '진행', due_date: '2026-11-11' }), T), W.eff(t({}), T)], ['완료', '지연', '진행', '지연', '진행'], '상태는 진행 · 완료 · 지연 — 마감일이 지나면 지연(오늘은 지연 아님), 완료는 지연 안 됨');
eq([W.taskWeek(t({ work_date: '2026-11-18', due_date: '2026-11-12' })), W.taskWeek(t({ due_date: '2026-11-12' })), W.taskWeek(t({}))], ['2026-11-16', '2026-11-09', ''], '주 배치는 날짜 기준, 없으면 마감일');
eq([W.placement({ work_date: '2026-11-10' }, T), W.placement({ work_date: '2026-11-17' }, T), W.placement({ work_date: '2026-11-03' }, T), W.placement({ work_date: '2026-11-25' }, T), W.placement({}, T)], ['금주', '차주', '지난 주(11.02 주)', '이후(11.23 주)', '날짜 없음'], '금주 · 차주 자동 배치');
var S = W.sample(T), d = W.dashboard(S, T);
eq([d.week, d.counts], ['2026-11-09', { total: 9, '진행': 5, '완료': 3, '지연': 1 }], '샘플 대시보드 집계');
ok(d.counts.total === d.counts['진행'] + d.counts['완료'] + d.counts['지연'], '세 상태의 합 = 전체');
ok(d.key.length === 6 && W.eff(d.key[0], T) === '지연' && d.key.every(function (x) { return W.eff(x, T) !== '완료'; }), '중요 업무는 지연 먼저, 완료 제외, 6건까지');
eq([d.next.length, d.nextTotal, d.decisions.length, d.byOwner.length], [5, 5, 3, 4], '차주 · 의사결정 · 담당자별');
S[0].reviewed = true;
eq([W.dashboard(S, T).decisions.length, W.dashboard(S, T, true).decisions.length, W.dashboard(S, T).reviewedCount], [2, 3, 1], '검토 완료 항목은 기본으로 숨긴다');
eq([W.filter(S, { owner: '김민수' }, T).length, W.filter(S, { field: '미분류' }, T).length, W.filter(S, { state: '지연' }, T).length, W.filter(S, { field: '자산', state: '완료' }, T).length, W.filter(S, { q: '비상 연락망' }, T).length], [4, 1, 1, 1, 1], '담당자 · 분야 · 상태 · 검색 필터');
ok(S.every(function (x) { return x.is_sample; }) && W.blankTask().is_sample === false, '샘플과 실제 등록 데이터 구분');

/* 중복 의심 · 등록 */
var have = [t({ owner: '김민수', title: '복지포인트 정산', work_date: '2026-11-10' })];
var rows = [{ row: 2, owner: '김민수', title: '복지 포인트  정산', work_date: '2026-11-11' }, { row: 3, owner: '김민수', title: '복지포인트 정산', work_date: '2026-11-17' }, { row: 4, owner: '이지은', title: '복지포인트 정산', work_date: '2026-11-11' }, { row: 5, owner: '김민수', title: '새 업무', work_date: '2026-11-11' }, { row: 6, owner: '김민수', title: '새 업무', work_date: '2026-11-12' }, { row: 7, owner: '김민수', title: '', work_date: '2026-11-12' }];
W.markDuplicates(rows, have);
ok(/이미 등록된/.test(rows[0].dup) && rows[1].dup === '' && rows[2].dup === '' && rows[3].dup === '' && /다른 행과 같습니다\(5행\)/.test(rows[4].dup) && rows[5].dup === '', '중복 의심 = 담당자 + 주요내용 + 같은 주(띄어쓰기 무시). 다른 주 · 다른 담당자는 아님');
rows[0].skip = true; rows.forEach(function (r) { r.file = 'a.xlsx'; r.sheet = 's'; r.detail = '원문\n둘째 줄'; });
var made = W.rowsToTasks(rows);
eq([made.length, made[0].title, made[0].detail, made[0].field, made[0].status, made[0].needs_decision, made[0].is_sample, made[0].source_file], [4, '복지포인트 정산', '원문\n둘째 줄', '', '', false, false, 'a.xlsx'], '등록: 제외 · 빈 제목은 빼고, 분야 · 상태 · 의사결정은 비워 둔다(엑셀에 없는 정보를 만들지 않음)');

/* 보고서 · 이력 · 저장 */
var rep = W.weekReport(W.sample(T), '2026-11-09', T);
eq([rep.cur.map(function (g) { return g.field + ':' + g.tasks.length; }), rep.next.map(function (g) { return g.field + ':' + g.tasks.length; })], [['복리후생 / 총무:3', '사회공헌 / 의전:2', '자산:2', '비상계획:2'], ['복리후생 / 총무:1', '사회공헌 / 의전:1', '자산:1', '비상계획:1', '미분류:1']], '주차 보고서 — 분야 4개 고정 순서, 미분류는 있을 때만');
ok(W.weekReport([], '2026-11-09', T).cur.length === 4, '업무가 없어도 4개 분야는 남는다');
var sh = W.reportSheets(W.sample(T), '2026-11-09', T)['주간업무보고'];
ok(sh.length === 4 + 14 && sh[3].join() === '구분,업무 분야,날짜,주요내용,마감일,담당자,진행 상태,의사결정,세부내용' && sh[4][0] === '금주', '보고서 엑셀');
eq(W.weeks(W.sample(T)), ['2026-11-16', '2026-11-09'], '주차 목록(최근 먼저)');
var saved = W.fromSaved(JSON.stringify({ tasks: [{ id: 'a', title: 'x', owner: 'k' }] }));
ok(saved.tasks[0].title === 'x' && saved.tasks[0].needs_decision === false && saved.tasks[0].field === '' && saved.logs.length === 0, '저장본 읽기 — 빠진 칸은 기본값');
eq([W.fromSaved('{bad'), W.fromSaved('{"rows":[]}'), W.fromSaved(null)], [null, null, null], '모르는 저장본은 읽지 않는다');
eq(W.templateAoa()[0], ['날짜', '주요내용', '마감일', '세부내용', '업무분류', '담당자'], '양식의 머리글 6개(v2.1 업무분류 · v2.2 담당자)');

/* v2.1 업무분류 */
eq(['업무분류', '업무 분야', '분류', 'Category'].map(W.headKey), ['field', 'field', 'field', 'field'], '업무분류 머리글');
eq([W.normField('복리후생/총무'), W.normField(' 사회공헌 / 의전 '), W.normField('자산'), W.normField('비상계획'), W.normField('미분류'), W.normField(''), W.normField('기타')], ['복리후생 / 총무', '사회공헌 / 의전', '자산', '비상계획', '미분류', '', ''], '업무분류 글자 맞추기(공백 · 빗금 무관), 모르는 값은 빈 값');
eq([['임직원 건강검진 업체 선정', '견적 비교'], ['지역 아동센터 봉사활동', '기부 물품 전달'], ['유휴 자산 매각 검토', '토지 감정'], ['을지연습 준비', '민방위 훈련 계획'], ['주간 회의', '자료 준비']].map(function (t) { return W.classify(t[0], t[1]).field; }),
  ['복리후생 / 총무', '사회공헌 / 의전', '자산', '비상계획', ''], '낱말로 자동 분류 — 맞는 낱말이 없으면 미분류');
eq([W.classify('봉사', '자산').field, W.classify('봉사', '자산').why], ['사회공헌 / 의전', ['봉사']], '제목의 낱말을 세부내용보다 무겁게 본다');
eq(W.classify('봉사 자산', '').field, '', '두 분류가 같은 점수면 미분류(사람이 고른다)');
ok(W.classify('건강검진', '').why.indexOf('건강검진') >= 0, '어떤 낱말로 분류했는지 남긴다');
var fa = [['날짜', '주요내용', '마감일', '세부내용', '업무분류'], ['2026-11-09', '건강검진 업체 선정', '', '', '자산'], ['2026-11-09', '건강검진 업체 선정', '', '', ''], ['2026-11-09', '주간 회의', '', '', '미분류'], ['2026-11-09', '예비군 훈련 통지', '', '', '기타']];
var fx = W.extractSheet(fa, W.inspectSheet(fa), 2026);
eq(fx.map(function (r) { return [r.field, r.field_src]; }), [['자산', 'file'], ['복리후생 / 총무', 'auto'], ['', 'file'], ['비상계획', 'auto']], '엑셀에 적힌 분류가 우선, 비었으면 자동, 미분류라고 적으면 미분류');
ok(fx[3].flags.some(function (x) { return /목록에 없어/.test(x); }) && fx[0].flags.length === 0, '목록에 없는 분류는 알리고 자동으로 돌린다');
eq(W.inspectSheet([['날짜', '주요내용']]).missing, ['due_date', 'detail'], '업무분류 열은 없어도 「없는 열」로 세지 않는다');
var ft = W.rowsToTasks([{ title: '가', field: '자산', owner: 'x' }, { title: '나', field: '미분류' }, { title: '다', field: '' }, { title: '라', field: '엉뚱' }]);
eq(ft.map(function (t) { return t.field; }), ['자산', '', '', ''], '등록 — 미리보기의 분류를 저장, 미분류 · 모르는 값은 빈 값');
ok(/type="list"/.test(W.dropdownXml('E')) && /sqref="E2:E500"/.test(W.dropdownXml('E')) && W.dropdownXml('E').indexOf('"복리후생 / 총무,사회공헌 / 의전,자산,비상계획,미분류"') > 0, '양식의 선택 목록 — 5개 항목');

/* v2.2 담당자 */
var KN = ['김민수', '박서준', '이하늘'];
eq(W.findOwner('회의 준비', '담당: 최영희 과장', KN), { owner: '최영희', why: '「담당: 최영희 과장」', known: false }, '「담당: 이름」으로 적힌 이름 — 등록 목록에 없어도 적힌 대로');
eq([W.findOwner('통근버스 계약', '담당자 박서준', KN).owner, W.findOwner('통근버스 계약', '담당자 박서준', KN).known], ['박서준', true], '적힌 이름이 등록 목록에 있으면 그 이름');
eq(W.findOwner('김민수 대리와 견적 검토', '', KN).owner, '김민수', '등록된 담당자 이름이 글에 한 사람만 나오면 그 사람');
eq([W.findOwner('김민수, 박서준 합동 점검', '', KN).owner, /여럿/.test(W.findOwner('김민수, 박서준 합동 점검', '', KN).why)], ['', true], '이름이 여럿 나오면 고르지 않는다(빈칸)');
eq([W.findOwner('비품 발주', '', KN).owner, W.findOwner('담당자 미정 건', '', KN).owner, W.findOwner('담당 변경 검토', '', KN).owner, W.findOwner('김민수 건', '', []).owner], ['', '', '', ''], '확인할 수 없으면 빈칸 — 이름을 지어내지 않는다(「미정」「변경」은 이름이 아님, 목록이 없으면 글 속 이름을 추측하지 않음)');
var oa = [['날짜', '주요내용', '마감일', '세부내용', '업무분류', '담당자'], ['2026-11-09', '김민수와 견적 검토', '', '', '', '이하늘'], ['2026-11-09', '김민수와 견적 검토', '', '', '', ''], ['2026-11-09', '비품 발주', '', '', '', ' ']];
var ox = W.extractSheet(oa, W.inspectSheet(oa), 2026, KN);
eq(ox.map(function (r) { return [r.own, r.own_src]; }), [['이하늘', 'file'], ['김민수', 'auto'], ['', '']], '담당자 — 엑셀 값이 우선, 비었으면 글에서, 못 찾으면 빈칸');
eq(W.inspectSheet([['날짜', '주요내용', '마감일', '세부내용']]).missing, [], '담당자 열은 없어도 「없는 열」로 세지 않는다');
eq(W.extractSheet([['주요내용', '날짜'], ['김민수 건', '2026-11-09']], W.inspectSheet([['주요내용', '날짜']]), 2026)[0].own, '', '등록 목록을 넘기지 않으면 자동으로 찾지 않는다');
var dx = W.dropdownXml('E', 500, KN);
ok(/count="2"/.test(dx) && /sqref="F2:F500"/.test(dx) && dx.indexOf('"김민수,박서준,이하늘"') > 0 && /showErrorMessage="0"[^>]*sqref="F2/.test(dx), '양식 — 담당자 칸 선택 목록(목록에 없는 이름도 적을 수 있게 오류는 끔)');
ok(/count="1"/.test(W.dropdownXml('E', 500, [])) && W.dropdownXml('E').indexOf('F2') < 0, '등록된 담당자가 없으면 담당자 목록은 넣지 않는다');
var longO = []; for (var li = 0; li < 80; li++) longO.push('담당자' + li);
ok((/sqref="F2:F500"><formula1>"([^"]*)"/.exec(W.dropdownXml('E', 500, longO)) || [0, ''])[1].length <= 250, '담당자가 많으면 엑셀 한도(255자) 안에서 자른다');

console.log('규칙 테스트: 통과 ' + passed + ' · 실패 ' + failed);
process.exit(failed ? 1 : 0);
