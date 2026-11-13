// 로그인 설정 — 이 파일 한 곳만 바꾸면 된다(생성: build-2611-00/tools/kit/apply-kit.mjs, 대문 문구 출처 docs/plan.json).
// 내 Supabase 로 옮길 때: url · anonKey 를 내 프로젝트 값으로, 카카오를 설정하지 않았으면 kakao: false. 안내 = docs/내_깃허브로_옮기기.md
// prefix 는 supabase/auth.sql 의 표 이름 앞부분과 같아야 한다.
window.AUTH_CONFIG = {
  "url": "https://hcmgdztsgjvzcyxyayaj.supabase.co",
  "anonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjbWdkenRzZ2p2emN5eHlheWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzU4ODcsImV4cCI6MjA4NzAxMTg4N30.gznaPzY1l8qDAPsEyYNR9KS7f7VqS3xaw-_2HTSwSZw",
  "prefix": "build261110",
  "kakao": true,
  "idleMinutes": 30,
  "localBypass": true,
  "board": true,
  "site": {
    "title": "주간업무보고",
    "summary": "팀원들의 엑셀 주간업무보고를 올리면 날짜 · 주요내용 · 마감일 · 세부내용을 원문 그대로 취합해 금주 · 차주로 나누고, 진행 · 완료 · 지연과 의사결정 필요 항목을 대시보드로 보여 주는 심플한 업무 현황 도구입니다. 메뉴는 네 개이고 자료는 브라우저에만 저장됩니다.",
    "course": "생성형 AI 업무자동화 전문가과정 · 2차수",
    "features": [
      {
        "name": "대시보드",
        "desc": "금주 숫자 4개, 중요 업무, 차주 예정, 담당자별 상태, 의사결정 필요 항목."
      },
      {
        "name": "주간업무 현황",
        "desc": "금주 · 차주 좌우 두 칸, 필터, 세부내용 펼치기, 등록 · 수정 · 삭제."
      },
      {
        "name": "엑셀 업로드",
        "desc": "4단계 — 올리기 · 추출 · 미리보기 · 최종 등록. 원문 유지, 중복 의심 확인."
      },
      {
        "name": "보고서 및 이력",
        "desc": "주차별 보고서와 담당자 · 상태 변경 · 업로드 이력, 인쇄 · 엑셀 · 백업."
      }
    ],
    "steps": [
      "엑셀 올리기",
      "4개 항목 추출",
      "미리보기",
      "최종 등록",
      "분야 · 상태 지정",
      "대시보드"
    ],
    "flow": [
      {
        "step": "엑셀 올리기",
        "desc": "여러 파일 · 여러 시트"
      },
      {
        "step": "4개 항목 추출",
        "desc": "머리글로 열 찾기, 원문 그대로"
      },
      {
        "step": "미리보기",
        "desc": "담당자 · 배치 · 날짜 · 중복 확인"
      },
      {
        "step": "최종 등록",
        "desc": "업무로 저장, 업로드 이력"
      },
      {
        "step": "분야 · 상태 지정",
        "desc": "현황 화면에서"
      },
      {
        "step": "대시보드",
        "desc": "집계 · 중요 업무 · 의사결정"
      }
    ],
    "goals": [
      "메뉴 4개(대시보드 · 주간업무 현황 · 엑셀 업로드 · 보고서 및 이력)로 줄입니다.",
      "엑셀에서 4개 항목만 원문 그대로 추출해 미리보기 뒤 등록합니다.",
      "금주 · 차주를 좌우로 나란히 보여 주고 담당자 · 분야 · 상태는 필터로 봅니다."
    ],
    "screen": "docs/img/screen.png",
    "plan": "plan.html",
    "report": "report.html",
    "home": true,
    "guide": {
      "screens": [],
      "data": [
        {
          "name": "tasks",
          "fields": "id · owner · work_date · title · due_date · detail · field · status('' | 진행 | 완료) · needs_decision · decision_request · decision_due · reviewed · is_sample · source_file · source_sheet · created_at · updated_at"
        },
        {
          "name": "logs",
          "fields": "id · type(status | edit | delete | upload) · at · owner · task_id · text"
        },
        {
          "name": "계산해서 쓰는 값",
          "fields": "지연(완료가 아니고 마감일 < 오늘) · 주(날짜가 속한 주의 월요일)"
        }
      ],
      "rules": [
        "상태는 진행 · 완료 · 지연 세 가지입니다. 지연은 저장하지 않고 「완료가 아니고 마감일이 오늘보다 앞」이면 지연으로 계산합니다(마감일 당일은 지연이 아님). 상태를 고르지 않은 업무는 진행으로 셉니다.",
        "주는 월요일에 시작합니다. 업무는 날짜가 속한 주에 배치하고, 날짜가 없으면 마감일로 배치합니다.",
        "엑셀의 주요내용 · 세부내용은 원문 그대로 둡니다(앞뒤 공백 · 줄바꿈 · 문단 포함). 셀 전체가 빈칸일 때만 빈 값입니다.",
        "읽지 못한 날짜는 비워 두고 원문을 보여 줍니다. 날짜를 추정하지 않습니다.",
        "분야 · 상태 · 의사결정 여부는 엑셀에 없으므로 등록할 때 비워 둡니다(미분류).",
        "중복 의심 = 같은 주 + 담당자 + 주요내용(띄어쓰기 · 기호 무시)이 같음. 자동으로 지우지 않고 사용자에게 확인합니다.",
        "최종 등록 전에는 아무것도 저장하지 않습니다.",
        "대시보드의 중요 업무는 지연 → 결정 필요 → 마감 빠른 순으로 6건까지, 완료는 빼고 보여 줍니다.",
        "샘플은 is_sample 로 구분하고 실제 등록 데이터와 섞어 지우지 않습니다."
      ],
      "limits": [
        "자료는 한 브라우저에만 있습니다. 팀원이 각자 올린 자료가 자동으로 합쳐지지 않습니다 — 취합 담당자 한 사람이 올리거나 백업 파일로 옮깁니다. 여러 사람이 함께 쓰려면 Supabase 같은 서버 저장소가 필요합니다(데이터 구조는 맞춰 둠).",
        "분야를 자동으로 분류하지 않습니다(이번 요청: 엑셀에 없는 항목은 미분류). 자동 분류가 필요하면 17번의 분류 규칙을 가져올 수 있습니다.",
        "지난주 보고서와 비교해 신규 · 계속 · 누락을 가려내는 기능은 17번에 있습니다.",
        "로그인 · 권한이 없습니다. 주소를 아는 사람은 자기 브라우저에서 따로 씁니다.",
        "업무분류 자동 분류는 낱말 규칙입니다. 문맥을 이해하는 AI 가 아니므로 미리보기에서 확인하고 고쳐야 합니다."
      ],
      "users": [
        "팀장(대시보드 · 금주/차주 현황 확인, 의사결정)",
        "팀원 · 취합 담당자(엑셀 업로드, 분야 · 상태 지정)"
      ],
      "flow": [
        {
          "step": "엑셀 올리기",
          "desc": "여러 파일 · 여러 시트"
        },
        {
          "step": "4개 항목 추출",
          "desc": "머리글로 열 찾기, 원문 그대로"
        },
        {
          "step": "미리보기",
          "desc": "담당자 · 배치 · 날짜 · 중복 확인"
        },
        {
          "step": "최종 등록",
          "desc": "업무로 저장, 업로드 이력"
        },
        {
          "step": "분야 · 상태 지정",
          "desc": "현황 화면에서"
        },
        {
          "step": "대시보드",
          "desc": "집계 · 중요 업무 · 의사결정"
        },
        {
          "step": "보고서",
          "desc": "주차별 · 인쇄 · 엑셀"
        }
      ]
    },
    "landing": {
      "company": {
        "name": "HD건설기계",
        "en": "HD CONSTRUCTION EQUIPMENT",
        "logo": "images/logo.png",
        "logoH": 24
      },
      "slides": [
        {
          "image": "images/slide-1.jpg",
          "tone": "dark"
        },
        {
          "image": "images/slide-2.jpg",
          "tone": "dark"
        },
        {
          "image": "images/slide-3.jpg",
          "tone": "dark"
        }
      ],
      "heroMode": "slide"
    }
  }
};
