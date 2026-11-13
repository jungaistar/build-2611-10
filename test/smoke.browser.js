/* 브라우저에 실제로 띄워 본다 — node test/smoke.browser.js (playwright 가 없으면 건너뜀). 오늘은 ?today=2026-11-12 로 고정 */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
var chromium;
try { chromium = require('playwright').chromium; }
catch (e) { try { chromium = require('playwright-core').chromium; } catch (e2) { console.log('playwright 가 없어 화면 연기 테스트를 건너뜁니다.'); process.exit(0); } }
var XLSX = require('../lib/xlsx.full.min.js');
var ROOT = path.join(__dirname, '..');
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
var srv = http.createServer(function (q, s) { var p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(p, function (e, b) { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(b); }); });
var passed = 0, failed = 0;
function ok(c, label, d) { if (process.env.SMOKE_V) console.log((c ? '  o ' : '  x ') + label); if (c) passed++; else { failed++; console.log('  X ' + label + (d != null ? '  ' + d : '')); } }
var count = function (pg, sel) { return pg.$$eval(sel, function (t) { return t.length; }); };
function xlsx(file, sheets) { var wb = XLSX.utils.book_new(); Object.keys(sheets).forEach(function (n) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[n]), n); }); fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); return file; }
srv.listen(0, async function () {
  var base = 'http://127.0.0.1:' + srv.address().port + '/', url = base + '?today=2026-11-12';
  var br = await chromium.launch(); var ctx = await br.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
  var pg = await ctx.newPage(), errs = []; pg.on('pageerror', function (e) { errs.push(e.message); });
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b10-smoke-'));
  async function nav(p) { await pg.click('#nav button[data-p=' + p + ']'); await pg.waitForFunction(function (x) { return document.body.dataset.page === x; }, p); }
  try {
    await pg.goto(url); await pg.waitForSelector('#k-total');
    ok(await count(pg, '#nav button') === 4, '메뉴는 4개');
    ok([await pg.textContent('#k-total'), await pg.textContent('#k-run'), await pg.textContent('#k-done'), await pg.textContent('#k-late')].join() === '9,5,3,1', '대시보드 현황 카드 4개(샘플 집계)');
    ok(await count(pg, '#d-key .mi') === 6 && await count(pg, '#d-next .mi') === 5 && await count(pg, '#d-owner .mi') === 4, '주요 업무 현황 — 금주 중요 6 · 차주 예정 · 담당자별');
    ok(await count(pg, '#d-dec tr') === 4 && /샘플/.test(await pg.textContent('#d-dec')), '의사결정 필요 항목 3건(샘플 표시)');
    await pg.click('#d-dec [data-act=review] >> nth=0');
    ok(await count(pg, '#d-dec tr') === 3, '검토 완료하면 기본으로 숨긴다');
    await pg.check('[data-ch=show-reviewed]');
    ok(await count(pg, '#d-dec tr') === 4 && /검토 취소/.test(await pg.textContent('#d-dec')), '「검토 완료 항목 보기」로 다시 조회');

    // 주간업무 현황
    await nav('status');
    ok(await count(pg, '#col-cur .item') === 9 && await count(pg, '#col-nxt .item') === 5, '금주 · 차주 좌우 두 열');
    var box = await pg.evaluate(function () { var a = document.querySelector('#col-cur').getBoundingClientRect(), b = document.querySelector('#col-nxt').getBoundingClientRect(); var l = document.querySelector('#col-cur .list'); return [Math.round(a.width - b.width), a.top === b.top, b.left > a.right, getComputedStyle(l).overflowY]; });
    ok(Math.abs(box[0]) <= 1 && box[1] && box[2] && box[3] === 'auto', '두 열은 같은 너비 · 나란히 · 따로 스크롤', JSON.stringify(box));
    ok(await pg.isHidden('#col-cur .item >> nth=0 >> .dt'), '세부내용은 접힌 채 시작');
    await pg.click('#col-cur .item >> nth=0 >> .row');
    ok(await pg.isVisible('#col-cur .item.open .dt') && await count(pg, '.item.open') === 1, '눌러서 그 업무만 펼친다');
    await pg.selectOption('[data-ch=f-owner]', '김민수');
    ok(await count(pg, '#col-cur .item') === 3 && await count(pg, '#col-nxt .item') === 1, '담당자 필터');
    await pg.selectOption('[data-ch=f-owner]', ''); await pg.selectOption('[data-ch=f-state]', '지연');
    ok(await count(pg, '#col-cur .item') === 1 && await count(pg, '#col-cur .item.late') === 1, '상태 필터(지연)');
    await pg.selectOption('[data-ch=f-state]', ''); await pg.selectOption('[data-ch=f-field]', '미분류');
    ok(await count(pg, '#col-nxt .item') === 1 && /분야 미분류/.test(await pg.textContent('#col-nxt')), '분야 필터(미분류)');
    await pg.selectOption('[data-ch=f-field]', '');
    // 등록 · 수정 · 삭제
    await pg.click('[data-act=new]'); await pg.fill('#taskform [data-f=title]', '시험 업무'); await pg.fill('#taskform [data-f=owner]', '홍길동'); await pg.fill('#taskform [data-f=due_date]', '2026-11-10'); await pg.fill('#taskform [data-f=detail]', '첫 줄\n둘째 줄');
    await pg.click('[data-act=form-save]');
    ok(await count(pg, '#col-cur .item') === 10 && await count(pg, '#col-cur .item.late') === 2 && /시험 업무/.test(await pg.textContent('#col-cur')), '업무 등록 — 마감일이 지나 지연으로 표시');
    var id = await pg.evaluate(function () { return window.__app.db().tasks.filter(function (t) { return t.title === '시험 업무'; })[0].id; });
    await pg.click('.item[data-id="' + id + '"] .row');
    ok((await pg.textContent('.item[data-id="' + id + '"] pre.orig')) === '첫 줄\n둘째 줄', '세부내용 줄바꿈 그대로');
    await pg.selectOption('.item[data-id="' + id + '"] [data-ch=set-status]', '완료');
    ok(/완료/.test(await pg.textContent('.item[data-id="' + id + '"] .bd')), '상태를 완료로 바꾸면 지연이 풀린다');
    await pg.click('.item[data-id="' + id + '"] [data-act=edit]'); await pg.fill('#taskform [data-f=title]', '시험 업무(수정)'); await pg.click('[data-act=form-save]');
    ok(/시험 업무\(수정\)/.test(await pg.textContent('#col-cur')), '업무 수정');
    await pg.click('.item[data-id="' + id + '"] [data-act=ask]'); await pg.click('.item[data-id="' + id + '"] [data-act=del]');
    ok(await count(pg, '#col-cur .item') === 9, '업무 삭제(한 번 더 확인)');
    await pg.click('[data-act=week][data-d="7"]');
    ok(await count(pg, '#col-cur .item') === 5 && await pg.isEnabled('[data-act=week][data-d="0"]'), '다음 주로 넘기기');

    // 엑셀 업로드 — 파일 2개, 열 순서 다름, 시트 2장, 중복, 날짜 오류
    var f1 = xlsx(path.join(tmp, '주간업무보고_김민수.xlsx'), { '금주': [['세부내용', '마감일', '주요내용', '날짜'], ['견적 3건 비교\n최종 선정 필요', '2026-11-13', '복지포인트 정산', '2026-11-10'], ['', '2026-11-20', '신규 복지몰 검토', '2026-11-17'], ['', '모름', '날짜 이상한 업무', '2026-11-11']], '메모': [['참고']] });
    var f2 = xlsx(path.join(tmp, 'weekly.xlsx'), { 's': [['날짜', '주요내용', '마감일', '세부내용'], ['2026-11-12', '비품 발주', '2026-11-14', '']] });
    await nav('upload');
    var fc = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#drop')]); await fc[0].setFiles([f1, f2]);
    await pg.waitForSelector('#up-prev');
    ok(await count(pg, '#up-files tr') === 3 && await count(pg, '#up-prev tr') === 5, '파일 2개 · 4행 미리보기');
    ok(await pg.inputValue('[data-ch=up-owner][data-i="0"]') === '김민수' && await pg.inputValue('[data-ch=up-owner][data-i="1"]') === '', '담당자는 파일 이름에서, 없으면 비움');
    ok(/중복 의심 1건/.test(await pg.textContent('#up-dup')) && await pg.isChecked('[data-ch=up-skip][data-i="0"][data-j="0"]'), '등록된 업무와 같으면 중복 의심 — 기본 「등록 안 함」');
    ok(/마감일을 읽지 못했습니다\(원문: 모름\)/.test(await pg.textContent('#up-prev')) && /메모[\s\S]*찾지 못했습니다/.test(await pg.textContent('#up-files')), '읽지 못한 날짜 · 머리글 없는 시트를 알린다');
    ok(/차주/.test(await pg.textContent('#up-prev tr:nth-child(3)')) && /금주/.test(await pg.textContent('#up-prev tr:nth-child(2)')), '날짜로 금주 · 차주 배치');
    ok(await pg.isDisabled('[data-act=up-commit]') && (await pg.evaluate(function () { return window.__app.db().tasks.length; })) === 14, '담당자가 비면 등록 못 함 · 등록 전에는 반영 안 됨');
    // v2.1 업무분류 — 자동 분류 · 미리보기에서 고치기
    var fsel = function (i, j) { return '#up-prev select[data-k="field"][data-i="' + i + '"][data-j="' + j + '"]'; };
    ok(await pg.inputValue(fsel(0, 1)) === '복리후생 / 총무' && await pg.inputValue(fsel(0, 2)) === '' && await pg.inputValue(fsel(1, 0)) === '복리후생 / 총무', '(v2.1) 업무분류 자동 — 복지 · 비품은 복리후생/총무, 맞는 낱말이 없으면 미분류');
    ok(/자동 · 복지/.test(await pg.textContent('#up-prev tr:nth-child(3)')) && /자동 분류 못 함/.test(await pg.textContent('#up-prev tr:nth-child(4)')), '(v2.1) 어떤 낱말로 분류했는지 표시');
    ok(await pg.$$eval(fsel(0, 1) + ' option', function (o) { return o.map(function (x) { return x.textContent; }).join('|'); }) === '미분류|복리후생 / 총무|사회공헌 / 의전|자산|비상계획', '(v2.1) 미리보기 선택 목록 5개');
    await pg.selectOption(fsel(0, 2), '자산');
    ok(await pg.inputValue(fsel(0, 2)) === '자산' && /직접 고름/.test(await pg.textContent('#up-prev tr:nth-child(4)')), '(v2.1) 미리보기에서 업무분류 직접 고르기');
    await pg.fill('[data-ch=up-owner][data-i="1"]', '박서준'); await pg.dispatchEvent('[data-ch=up-owner][data-i="1"]', 'change');
    await pg.click('[data-act=up-commit]'); await pg.waitForSelector('#up-done');
    ok(/3건을 등록했습니다/.test(await pg.textContent('#up-done')), '최종 등록 3건(중복 1건 제외)');
    var st = await pg.evaluate(function () { var t = window.__app.db().tasks.filter(function (x) { return !x.is_sample; }); return [t.length, t.map(function (x) { return x.field + x.status + x.needs_decision; }).join(), t.filter(function (x) { return x.owner === '박서준' && x.source_file === 'weekly.xlsx'; }).length]; });
    ok(st[0] === 3 && st[1] === '복리후생 / 총무false,자산false,복리후생 / 총무false' && st[2] === 1, '(v2.1) 업무분류는 미리보기 값으로 등록 · 상태 · 의사결정은 비움, 출처 파일 기록', JSON.stringify(st));
    // 양식 — 업무분류 열과 선택 목록, 분류를 적어 올리면 그 값이 우선
    await nav('upload'); if (await pg.$('[data-act=up-reset]')) await pg.click('[data-act=up-reset]');
    var td = pg.waitForEvent('download'); await pg.click('[data-act=tpl]'); var tf = await td, tp = path.join(tmp, 'tpl.xlsx'); await tf.saveAs(tp);
    var twb = XLSX.read(fs.readFileSync(tp)), tz = XLSX.CFB.read(fs.readFileSync(tp), { type: 'buffer' }), tix = -1; tz.FullPaths.forEach(function (q, i) { if (/sheet1\.xml$/.test(q)) tix = i; });
    var txml = Buffer.from(tz.FileIndex[tix].content).toString('utf8');
    ok(XLSX.utils.sheet_to_json(twb.Sheets[twb.SheetNames[0]], { header: 1 })[0].join() === '날짜,주요내용,마감일,세부내용,업무분류,담당자' && /<dataValidation type="list"[^>]*sqref="E2:E500"/.test(txml) && txml.indexOf('복리후생 / 총무,사회공헌 / 의전,자산,비상계획,미분류') > 0, '(v2.1) 양식 — 업무분류 열 + 선택 목록(엑셀에서 열림)');
    var f3 = xlsx(path.join(tmp, '주간업무보고_이하늘.xlsx'), { 's': [['날짜', '주요내용', '마감일', '세부내용', '업무분류'], ['2026-11-12', '건강검진 일정 안내', '2026-11-14', '', '비상계획'], ['2026-11-12', '예비군 훈련 통지', '', '', '']] });
    var fc3 = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#drop')]); await fc3[0].setFiles([f3]); await pg.waitForSelector('#up-prev');
    ok(await pg.inputValue(fsel(0, 0)) === '비상계획' && /엑셀 값/.test(await pg.textContent('#up-prev tr:nth-child(2)')) && await pg.inputValue(fsel(0, 1)) === '비상계획' && /자동 · /.test(await pg.textContent('#up-prev tr:nth-child(3)')), '(v2.1) 엑셀에 적힌 분류가 우선, 빈 칸은 자동');
    // v2.2 담당자 — 엑셀 값 우선 · 글에서 찾기 · 파일 담당자 · 미리보기에서 고치기
    var osel = function (i, j) { return '#up-prev input[data-k="own"][data-i="' + i + '"][data-j="' + j + '"]'; };
    ok(await pg.inputValue(osel(0, 0)) === '' && /파일 담당자 이하늘/.test(await pg.textContent('#up-prev tr:nth-child(2)')), '(v2.2) 담당자 칸이 비면 파일 이름의 담당자');
    await pg.click('[data-act=up-reset]');
    var f4 = xlsx(path.join(tmp, 'weekly_all.xlsx'), { 's': [['날짜', '주요내용', '마감일', '세부내용', '업무분류', '담당자'], ['2026-11-12', '식당 위생 점검', '', '', '', '박서준'], ['2026-11-12', '김민수 대리와 임대 계약 검토', '', '', '', ''], ['2026-11-12', '소방 훈련 준비', '', '담당: 최영희 과장', '', ''], ['2026-11-12', '사무용품 정리', '', '', '', '']] });
    var fc4 = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#drop')]); await fc4[0].setFiles([f4]); await pg.waitForSelector('#up-prev');
    ok(await pg.inputValue(osel(0, 0)) === '박서준' && /엑셀 값/.test(await pg.textContent('#up-prev tr:nth-child(2) td:nth-child(2)')), '(v2.2) 엑셀에 적힌 담당자가 우선');
    ok(await pg.inputValue(osel(0, 1)) === '김민수' && /자동 · 등록된 담당자 이름/.test(await pg.textContent('#up-prev tr:nth-child(3)')), '(v2.2) 등록된 담당자 이름이 글에 나오면 자동');
    ok(await pg.inputValue(osel(0, 2)) === '최영희' && /자동 · 「담당: 최영희 과장」/.test(await pg.textContent('#up-prev tr:nth-child(4)')), '(v2.2) 「담당: 이름」으로 적힌 이름');
    ok(await pg.inputValue(osel(0, 3)) === '' && /미지정/.test(await pg.textContent('#up-prev tr:nth-child(5) td:nth-child(2)')) && await pg.isDisabled('[data-act=up-commit]'), '(v2.2) 확인할 수 없으면 빈칸 — 이름을 지어내지 않고 등록을 막는다');
    await pg.fill(osel(0, 3), '이하늘'); await pg.dispatchEvent(osel(0, 3), 'change');
    ok(/직접 고름/.test(await pg.textContent('#up-prev tr:nth-child(5) td:nth-child(2)')) && await pg.isEnabled('[data-act=up-commit]'), '(v2.2) 미리보기에서 담당자를 직접 고르면 등록할 수 있다');
    await pg.click('[data-act=up-commit]'); await pg.waitForSelector('#up-done');
    var ow = await pg.evaluate(function () { return window.__app.db().tasks.filter(function (x) { return x.source_file === 'weekly_all.xlsx'; }).map(function (x) { return x.owner + '/' + x.field; }).join(); });
    ok(ow === '박서준/복리후생 / 총무,김민수/자산,최영희/비상계획,이하늘/복리후생 / 총무', '(v2.2) 등록 — 확정한 담당자 · 업무분류가 그대로 저장', ow);
    await nav('upload'); if (await pg.$('[data-act=up-reset]')) await pg.click('[data-act=up-reset]');
    var td2 = pg.waitForEvent('download'); await pg.click('[data-act=tpl]'); var tf2 = await td2, tp2 = path.join(tmp, 'tpl2.xlsx'); await tf2.saveAs(tp2);
    var tz2 = XLSX.CFB.read(fs.readFileSync(tp2), { type: 'buffer' }), tix2 = -1; tz2.FullPaths.forEach(function (q, i) { if (/sheet1\.xml$/.test(q)) tix2 = i; });
    var txml2 = Buffer.from(tz2.FileIndex[tix2].content).toString('utf8'), th2 = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(tp2)).Sheets['주간업무'], { header: 1 })[0].join();
    ok(th2 === '날짜,주요내용,마감일,세부내용,업무분류,담당자' && /sqref="F2:F500"/.test(txml2) && /김민수/.test(txml2) && /이하늘/.test(txml2), '(v2.2) 양식 — 담당자 열 + 등록된 담당자 선택 목록', th2);
    // 뒤의 시험(건수)에 영향을 주지 않게 방금 등록한 4건과 그 업로드 기록을 지운다
    await pg.evaluate(function () { var d = window.__app.db(); d.tasks = d.tasks.filter(function (x) { return x.source_file !== 'weekly_all.xlsx'; }); d.logs = d.logs.filter(function (l) { return l.owner !== 'weekly_all.xlsx'; }); window.__app.save(); });
    await pg.reload(); await pg.waitForSelector('#view');
    // 보고서 및 이력
    await nav('hist');
    ok(/전체 11건/.test((await pg.textContent('#h-report')).replace(/\s+/g, ' ').replace('전체 11 건', '전체 11건')) || /전체\s*11/.test(await pg.textContent('#h-report')), '주차별 보고서(금주 11건)');
    ok(await count(pg, '#h-report tr.fieldhead') >= 9, '분야별로 묶어 보여 준다');
    await pg.click('[data-act=tab][data-k=upload]');
    ok(await count(pg, '#h-logs tr') === 3 && /weekly\.xlsx/.test(await pg.textContent('#h-logs')), '엑셀 업로드 이력 2건');
    await pg.click('[data-act=tab][data-k=status]');
    ok(/상태 진행\(미지정\) → 완료/.test(await pg.textContent('#h-logs')) && /삭제/.test(await pg.textContent('#h-logs')), '상태 변경 · 삭제 이력');
    await pg.click('[data-act=tab][data-k=owner]'); await pg.selectOption('[data-ch=h-owner]', '김민수');
    ok(await count(pg, '#h-owner tr') === 7, '담당자별 업무 이력');
    await pg.click('[data-act=tab][data-k=report]');
    var dl = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act=xlsx]')]); var fx = path.join(tmp, 'rep.xlsx'); await dl[0].saveAs(fx);
    ok(XLSX.read(fs.readFileSync(fx), { type: 'buffer' }).SheetNames[0] === '주간업무보고', '보고서 엑셀 내려받기');

    // 새로고침 뒤 유지 · 샘플 삭제
    await pg.reload(); await pg.waitForSelector('#view h2');
    ok((await pg.evaluate(function () { return window.__app.db().tasks.length; })) === 17, '새로고침 뒤에도 자료가 남는다');
    await pg.click('[data-act=clear-sample]');
    ok((await pg.evaluate(function () { var t = window.__app.db().tasks; return t.length + ':' + t.filter(function (x) { return x.is_sample; }).length; })) === '3:0' && await pg.isHidden('#sb-sample'), '샘플 데이터만 지운다(등록한 업무는 유지)');
    await nav('dash');
    ok(await pg.textContent('#k-total') === '2', '대시보드가 실제 등록 데이터로 집계');
    for (var wd of [390, 820]) { await pg.setViewportSize({ width: wd, height: 800 }); for (var p of ['dash', 'status', 'upload', 'hist']) { await nav(p); var over = await pg.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; }); ok(over <= 1, wd + 'px 가로 넘침 없음 — ' + p, over); } }
    for (var page of ['guide.html', 'plan.html']) { var rr = await pg.goto(base + page); ok(rr.status() === 200, page + ' 열림'); }
    ok(errs.length === 0, '페이지 오류 없음', errs.join(' | '));
  } catch (e) { failed++; console.log('  X 중단: ' + e.message.split('\n')[0]); if (errs.length) console.log('    ' + errs.join(' | ')); }
  await br.close(); srv.close();
  console.log('화면 테스트: 통과 ' + passed + ' · 실패 ' + failed);
  process.exit(failed ? 1 : 0);
});
