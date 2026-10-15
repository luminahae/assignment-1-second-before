/* =========================================================================
 * data.js — 과제 제출 1초 전
 * 게임의 모든 "콘텐츠 데이터"를 이 파일에 모아 두었습니다.
 * 사건/엔딩/파일/과목을 추가하고 싶다면 대부분 이 파일만 수정하면 됩니다.
 * (게임 로직은 game.js 에 있습니다.)
 * ======================================================================= */

/* -------------------------------------------------------------------------
 * 1) 과목 / 과제 풀 (상단 헤더에 표시, 게임마다 랜덤)
 * ---------------------------------------------------------------------- */
const SUBJECTS = [
  { course: 'UX 디자인 스튜디오', task: '최종 발표자료' },
  { course: '건축환경공학', task: '주광 성능 분석 보고서' },
  { course: '브랜드 디자인', task: '굿즈 제안서' },
  { course: '현대사회와 윤리', task: '개인 에세이' },
  { course: '자료구조', task: '기말 프로젝트 보고서' },
  { course: '시각디자인 기초', task: '포스터 3종' },
  { course: '경영정보시스템', task: '팀 케이스 분석' },
  { course: '영상편집 워크숍', task: '30초 프로모션 영상 기획서' },
];

/* -------------------------------------------------------------------------
 * 2) 파일 풀
 * 매 게임마다 이 목록에서 6~8개를 뽑고, 그중 하나를 "진짜 제출 파일"로 지정합니다.
 * 진짜 파일 여부는 game.js 에서 단서(폰트/이미지/용량/확장자/최신본)를 조합해
 * 동적으로 결정하므로, 여기서는 후보들의 "성격"만 정의합니다.
 *
 * kind:
 *  'candidate' - 진짜 제출 파일이 될 수 있는 정상 후보
 *  'decoy'     - 가짜 (오래된/깨진/다른 과목/함정 파일 등)
 *  'trap'      - 특수 함정 (열면 큰 사건, 제출하면 특수 엔딩)
 * ---------------------------------------------------------------------- */
const FILE_POOL = [
  // ---- 정상 후보군 (진짜 파일 후보) ----
  { base: '최종',                 ext: 'pdf',  kind: 'candidate' },
  { base: '진짜최종',             ext: 'pdf',  kind: 'candidate' },
  { base: '진짜최종수정',         ext: 'pdf',  kind: 'candidate' },
  { base: '최종최종_이거임',      ext: 'pdf',  kind: 'candidate' },
  { base: '최종본_제출용',        ext: 'pdf',  kind: 'candidate' },
  { base: '발표자료_최종',        ext: 'pptx', kind: 'candidate' },
  { base: '보고서_v9_찐막',       ext: 'pdf',  kind: 'candidate' },

  // ---- 가짜/함정군 ----
  { base: '발표자료_복구본_2',    ext: 'pptx', kind: 'decoy',
    note: '한글이 깨진 자동복구 파일' },
  { base: '최종본_이걸로제출',    ext: 'pptx.pdf', kind: 'trap',
    note: '확장자가 .pptx.pdf 라 교수님이 못 여는 파일',
    ending: 'cant_open' },
  { base: '교수님보내지마세요',    ext: 'pdf',  kind: 'trap',
    note: '팀원 뒷담화가 적힌 절대 금지 파일',
    ending: 'forbidden_file' },
  { base: '절대열지마세요',       ext: 'zip',  kind: 'trap',
    note: '열면 압축 해제 지옥이 시작되는 파일',
    ending: 'zip_bomb' },
  { base: '새 폴더 (3)',          ext: '',     kind: 'decoy',
    note: '폴더입니다. 제출할 수 없습니다.' },
  { base: '이력서_2019',          ext: 'pdf',  kind: 'decoy',
    note: '다른 과목도 아닌 그냥 이력서' },
  { base: '기말_다른과목_통계',   ext: 'pdf',  kind: 'decoy', wrongSubject: true,
    note: '다른 과목 과제 파일' },
  { base: '중간고사_스캔본',      ext: 'pdf',  kind: 'decoy', wrongSubject: true,
    note: '이번 과제가 아닌 지난 시험 스캔' },
  { base: '빈문서',               ext: 'pdf',  kind: 'trap',
    note: '내용이 하나도 없는 빈 PDF',
    ending: 'empty_pdf', empty: true },
];

/* -------------------------------------------------------------------------
 * 3) 랜덤 사건 풀
 * 게임 도중 일정 시간마다 하나씩 발생합니다.
 * 각 사건은 choices[] 를 가지며, 선택 시 effect(state) 로 상태를 바꿉니다.
 * effect 안에서 사용할 수 있는 상태 값(state):
 *   time, mental, teamTrust, profSuspicion, completeness, net('online'|'weak'|'off')
 * 그리고 로그를 남기려면 state.log('메시지') 사용.
 *
 * kind: 'messenger' | 'error' | 'popup'  (표시 스타일 결정)
 * once: true 면 한 게임에서 한 번만 등장
 * weight: 뽑힐 확률 가중치(기본 1)
 * ---------------------------------------------------------------------- */
const EVENTS = [
  {
    id: 'team_new_version',
    kind: 'messenger',
    who: '팀원 김OO',
    title: '카톡: 팀원이 새 수정본을 보냄',
    body: '"야 아까 거 말고 이걸로 제출해!! 방금 표 하나 고침 🙏"',
    weight: 2,
    choices: [
      { label: '수정본 반영 (완성도↑ 시간↓↓)', effect: (s) => {
        s.completeness = clamp(s.completeness + 14);
        s.time -= 25; s.teamTrust = clamp(s.teamTrust + 8);
        s.log('팀원 수정본을 반영했다. 완성도는 올랐지만 25초가 날아갔다.');
      }},
      { label: '무시하고 원래 파일로 (시간 지킴, 신뢰↓)', effect: (s) => {
        s.teamTrust = clamp(s.teamTrust - 18);
        s.flags.ignoredTeammate = true;
        s.log('팀원의 마지막 수정본을 무시했다. 읽씹의 대가는 나중에...');
      }},
      { label: '"응 반영했어"라고 거짓말 (신뢰 유지, 위험)', effect: (s) => {
        s.mental = clamp(s.mental - 8);
        s.flags.liedToTeammate = true;
        s.log('반영 안 했으면서 반영했다고 했다. 양심이 1 깎였다.');
      }},
    ],
  },
  {
    id: 'wifi_drop',
    kind: 'error',
    who: '네트워크',
    title: '⚠ 와이파이 연결이 끊어졌습니다',
    body: '업로드 속도가 급격히 느려집니다. 지금 제출하면 위험합니다.',
    weight: 1,
    choices: [
      { label: '핸드폰 핫스팟 연결 (시간↓, 인터넷 복구)', effect: (s) => {
        s.time -= 15; s.net = 'online';
        s.log('핫스팟을 켰다. 데이터가 녹지만 인터넷은 살았다.');
      }},
      { label: '그냥 기다린다 (인터넷 불안정 유지)', effect: (s) => {
        s.net = 'weak'; s.mental = clamp(s.mental - 6);
        s.log('와이파이가 살아나길 기도했다. 신은 바빴다.');
      }},
    ],
  },
  {
    id: 'session_expired',
    kind: 'error',
    who: '제출 사이트',
    title: '세션이 만료되었습니다',
    body: '자동 로그아웃되었습니다. 다시 로그인해야 제출할 수 있습니다.',
    weight: 1,
    choices: [
      { label: '다시 로그인 (시간↓)', effect: (s) => {
        s.time -= 12; s.log('다시 로그인했다. 비밀번호가 기억나서 다행이다.');
      }},
      { label: '비밀번호 찾기부터... (시간↓↓, 멘탈↓)', effect: (s) => {
        s.time -= 28; s.mental = clamp(s.mental - 12);
        s.log('비밀번호를 까먹었다. 인증 메일을 기다리는 30초가 30분 같았다.');
      }},
    ],
  },
  {
    id: 'image_missing',
    kind: 'popup',
    who: '미리보기',
    title: '이미지 누락 감지',
    body: '문서에서 이미지 3개가 빨간 X로 표시됩니다. 링크가 깨졌습니다.',
    weight: 1,
    choices: [
      { label: '이미지 다시 삽입 (완성도↑ 시간↓)', effect: (s) => {
        s.completeness = clamp(s.completeness + 10); s.time -= 20;
        s.log('깨진 이미지를 다시 넣었다. 손이 떨렸다.');
      }},
      { label: '"원래 이런 컨셉이었어" (완성도↓, 멘탈↑)', effect: (s) => {
        s.completeness = clamp(s.completeness - 12); s.mental = clamp(s.mental + 5);
        s.log('빨간 X를 디자인이라고 우겼다. 마음은 편해졌다.');
      }},
    ],
  },
  {
    id: 'font_broken',
    kind: 'popup',
    who: '미리보기',
    title: '폰트 깨짐 경고',
    body: '다른 컴퓨터에서 제목 폰트가 □□□ 로 보일 수 있습니다.',
    weight: 1,
    choices: [
      { label: '폰트를 전부 이미지로 변환 (완성도↑ 용량↑ 시간↓)', effect: (s) => {
        s.completeness = clamp(s.completeness + 8); s.time -= 16;
        s.flags.fontsToImage = true;
        s.log('폰트를 이미지로 박제했다. 용량이 불어났다.');
      }},
      { label: '기본 폰트로 대체 (완성도 살짝↓, 빠름)', effect: (s) => {
        s.completeness = clamp(s.completeness - 5); s.time -= 4;
        s.log('맑은 고딕으로 갈아탔다. 디자인은 죽었지만 시간은 살았다.');
      }},
    ],
  },
  {
    id: 'size_over',
    kind: 'error',
    who: '제출 사이트',
    title: '파일 용량 초과 (501MB / 제한 100MB)',
    body: '영상이 포함되어 용량이 너무 큽니다. 이대로는 업로드할 수 없습니다.',
    weight: 1,
    choices: [
      { label: '영상 파일 삭제 (제출 가능, 완성도↓)', effect: (s) => {
        s.completeness = clamp(s.completeness - 15); s.canSubmit = true;
        s.log('발표 하이라이트 영상을 지웠다. 용량은 12MB가 됐다.');
      }},
      { label: '화질을 240p로 압축 (완성도 살짝↓ 시간↓)', effect: (s) => {
        s.completeness = clamp(s.completeness - 6); s.time -= 18; s.canSubmit = true;
        s.log('영상을 모자이크 수준으로 압축했다. 뭐가 뭔지 모르겠지만 올라간다.');
      }},
    ],
  },
  {
    id: 'prof_notice',
    kind: 'popup',
    who: 'LMS 공지',
    title: '교수님이 공지사항을 수정함',
    body: '"제출 시 파일명은 반드시 <학번_이름>. 안 지키면 감점."',
    weight: 1,
    choices: [
      { label: '파일명 규칙대로 변경 (의심↓ 시간↓)', effect: (s) => {
        s.profSuspicion = clamp(s.profSuspicion - 10); s.time -= 10;
        s.log('파일명을 규칙대로 바꿨다. 교수님이 조금 안심했을 것이다.');
      }},
      { label: '무시 (시간 지킴, 의심↑)', effect: (s) => {
        s.profSuspicion = clamp(s.profSuspicion + 12);
        s.log('공지를 못 본 척했다. 교수님의 눈이 가늘어졌다.');
      }},
    ],
  },
  {
    id: 'deadline_cut',
    kind: 'error',
    who: '📢 긴급 공지',
    title: '제출 마감이 30초 앞당겨졌습니다',
    body: '"서버 점검으로 마감을 30초 단축합니다." — 조교',
    once: true,
    weight: 1,
    choices: [
      { label: '(선택지 없음) 받아들인다', effect: (s) => {
        s.time -= 30; s.mental = clamp(s.mental - 10);
        s.log('마감이 30초 줄었다. 세상은 원래 불공평하다.');
      }},
    ],
  },
  {
    id: 'prof_name_typo',
    kind: 'popup',
    who: '제출 폼',
    title: '담당 교수님 성함 확인',
    body: '입력한 교수님 성함이 "김철수" 인데... 우리 교수님 성함이 맞나요?',
    weight: 1,
    choices: [
      { label: '급하게 검색해서 수정 (의심↓ 시간↓)', effect: (s) => {
        s.profSuspicion = clamp(s.profSuspicion - 8); s.time -= 9;
        s.log('교수님 성함을 겨우 찾아 고쳤다.');
      }},
      { label: '"김철수 맞겠지" (의심↑↑)', effect: (s) => {
        s.profSuspicion = clamp(s.profSuspicion + 16);
        s.flags.wrongProfName = true;
        s.log('남의 교수님 성함으로 제출할 뻔했다. 아직 뻔한 상태다.');
      }},
    ],
  },
  {
    id: 'readonly_lock',
    kind: 'error',
    who: '파일 시스템',
    title: '파일이 읽기 전용으로 잠김',
    body: '"이 파일은 다른 프로그램에서 사용 중입니다." — 한글/PPT가 안 꺼짐',
    weight: 1,
    choices: [
      { label: '작업 관리자로 강제 종료 (시간↓)', effect: (s) => {
        s.time -= 11; s.log('강제 종료했다. 저장 안 한 게 없길 기도했다.');
      }},
      { label: '다른 이름으로 저장 (파일 하나 더 생김, 혼란↑)', effect: (s) => {
        s.mental = clamp(s.mental - 7); s.time -= 5;
        s.flags.moreFiles = true;
        s.log('"최종최종최종.pdf"가 하나 더 태어났다.');
      }},
    ],
  },
  {
    id: 'team_conflict',
    kind: 'messenger',
    who: '팀원 이OO',
    title: '카톡: 팀원끼리 싸우는 중',
    body: '"내 이름 왜 맨 뒤임?" / "가나다순이잖아" / "..." (읽음 3)',
    weight: 1,
    choices: [
      { label: '중재한다 (신뢰↑ 시간↓)', effect: (s) => {
        s.teamTrust = clamp(s.teamTrust + 10); s.time -= 14;
        s.log('싸움을 말렸다. 리더십이란 이런 것이다. 근데 시간이...');
      }},
      { label: '조용히 나간다 (시간 지킴, 신뢰↓)', effect: (s) => {
        s.teamTrust = clamp(s.teamTrust - 10);
        s.log('단톡방을 나갔다. 평화란 이런 것이다.');
      }},
    ],
  },
];

/* -------------------------------------------------------------------------
 * 4) 업로드 중 사건 (업로드 진행 중 랜덤 발생)
 * ---------------------------------------------------------------------- */
const UPLOAD_EVENTS = [
  {
    id: 'stuck_99',
    title: '업로드가 99%에서 멈췄습니다',
    body: '진행 바가 부들부들 떨고 있습니다. 시간은 계속 흐릅니다.',
    choices: [
      { label: '조금 더 기다린다 (도박: 시간↓)', effect: (s) => {
        s.time -= 12;
        if (Math.random() < 0.5) { s.uploadDone = true; s.log('99%의 벽을 뚫었다! 기적이다.'); }
        else { s.log('여전히 99%. 진행 바가 나를 비웃는다.'); }
      }},
      { label: '취소하고 다시 올린다 (진행률 초기화)', effect: (s) => {
        s.uploadProgress = 0; s.time -= 6;
        s.log('업로드를 취소했다. 0%부터 다시. 용감한 결정이다.');
      }},
    ],
  },
  {
    id: 'logout_mid',
    title: '업로드 중 로그아웃됨',
    body: '제출 사이트가 세션 만료로 튕겼습니다. 방금 그건 뭐였을까요.',
    choices: [
      { label: '다시 로그인 후 재업로드 (진행률 초기화, 시간↓)', effect: (s) => {
        s.uploadProgress = 0; s.time -= 14;
        s.log('다시 로그인. 업로드 바가 처음으로 돌아갔다.');
      }},
    ],
  },
];

/* -------------------------------------------------------------------------
 * 5) 제출 직전 "마지막 선택" (제출 버튼을 눌렀을 때 한 번 등장)
 * ---------------------------------------------------------------------- */
const FINAL_CHOICES = [
  {
    id: 'check_or_not',
    title: '제출 직전 마지막 확인',
    body: '파일을 열어 내용을 다시 확인하시겠습니까? 시간이 얼마 없습니다.',
    choices: [
      { label: '꼼꼼히 확인 (시간↓, 실수 방지)', effect: (s) => {
        s.time -= 10; s.flags.checkedFinal = true;
        s.log('마지막으로 파일을 열어봤다. 확인은 배신하지 않는다.');
      }},
      { label: '확인 안 하고 바로 제출 (빠름, 위험)', effect: (s) => {
        s.flags.checkedFinal = false;
        s.log('확인 없이 질렀다. 자신감인지 자포자기인지.');
      }},
    ],
  },
  {
    id: 'remove_teammate',
    title: '팀원 이름 처리',
    body: '연락 안 되는 팀원이 한 명 있습니다. 그 이름을 빼고 제출할까요?',
    choices: [
      { label: '이름 다 넣고 제출 (정의롭다)', effect: (s) => {
        s.log('연락 안 된 팀원 이름도 넣어줬다. 대인배.');
      }},
      { label: '한 명 빼고 제출 (독재자의 길)', effect: (s) => {
        s.teamTrust = clamp(s.teamTrust - 25);
        s.flags.removedTeammate = true;
        s.log('팀원 한 명의 이름을 지웠다. 조용한 학살이었다.');
      }},
    ],
  },
];

/* -------------------------------------------------------------------------
 * 6) 엔딩 정의
 * 우선순위(priority)가 높은 것부터 검사하여 조건(cond)이 맞으면 그 엔딩으로 종료.
 * cond(ctx) 의 ctx: { state, submitted(bool), submittedFile, timeout(bool) }
 * ---------------------------------------------------------------------- */
const ENDINGS = [
  {
    id: 'forbidden_file', priority: 100,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.endingTag === 'forbidden_file',
    title: '‘교수님보내지마세요.pdf’ 제출',
    emoji: '😱',
    desc: '하필 그 파일을 제출했다. 교수님이 팀원 뒷담화 12페이지를 정독 중이시다.',
  },
  {
    id: 'zip_bomb', priority: 99,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.endingTag === 'zip_bomb',
    title: '절대열지마세요.zip 제출',
    emoji: '🗜️',
    desc: '교수님이 압축을 풀자 폴더 안에 폴더, 그 안에 또 폴더... 조교가 울면서 퇴근했다.',
  },
  {
    id: 'empty_pdf', priority: 98,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.endingTag === 'empty_pdf',
    title: '빈 PDF 제출 후 휴학',
    emoji: '📄',
    desc: '새하얀 A4 한 장이 업로드됐다. 여백의 미를 이해 못 한 교수님과 함께 다음 학기를 기약한다.',
  },
  {
    id: 'cant_open', priority: 97,
    cond: (c) => c.submitted && c.submittedFile &&
      (c.submittedFile.endingTag === 'cant_open' || c.submittedFile.ext === 'pptx.pdf'),
    title: '교수님이 열 수 없는 파일',
    emoji: '🚫',
    desc: '.pptx.pdf. 세상 그 어떤 프로그램도 이 파일을 열지 못했다. 교수님은 그것을 0점이라 불렀다.',
  },
  {
    id: 'wrong_subject', priority: 90,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.wrongSubject,
    title: '제출은 했지만 다른 과목 파일',
    emoji: '🔀',
    desc: '분명 제출은 성공했다. 다만 그게 통계학 과제였을 뿐. 교수님도 당황하셨다.',
  },
  {
    id: 'insisted_email', priority: 85,
    cond: (c) => c.state.flags.insistedEmail && !c.submitted,
    title: '메일로 보냈다고 우긴 자',
    emoji: '📧',
    desc: '"어? 저 분명 메일로 보냈는데요?" 보낸 메일함은 텅 비어 있었지만, 자신감만은 가득했다.',
  },
  {
    id: 'dictator', priority: 80,
    cond: (c) => c.submitted && c.state.flags.removedTeammate,
    title: '팀원의 이름을 빼고 제출한 독재자',
    emoji: '👑',
    desc: '제출은 완벽했다. 다만 팀원 한 명이 세상에서 지워졌을 뿐. 단톡방은 조용해졌다.',
  },
  {
    id: 'stuck_99_legend', priority: 70,
    cond: (c) => c.timeout && c.state.uploading && c.state.uploadProgress >= 98 && !c.submitted,
    title: '업로드 99%의 전설',
    emoji: '⏳',
    desc: '마감이 지나는 순간까지 진행 바는 99%에 멈춰 있었다. 그 1%는 어디로 갔을까. 아무도 모른다.',
  },
  {
    id: 'last_01', priority: 60,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.isCorrect && c.state.timeAtSubmit <= 1,
    title: '마감 0.1초 전 제출',
    emoji: '⚡',
    desc: '00:00:00 을 코앞에 두고 완료 버튼이 눌렸다. 심장은 아직도 뛰고 있다. 살았다. 살아남았다.',
  },
  {
    id: 'miracle', priority: 50,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.isCorrect && c.state.completeness >= 70,
    title: '기적의 정상 제출',
    emoji: '🎉',
    desc: '진짜 최종 파일이, 멀쩡한 상태로, 마감 전에 제출됐다. 이런 날도 있다. 오늘은 운수 좋은 날.',
  },
  {
    id: 'submitted_rough', priority: 45,
    cond: (c) => c.submitted && c.submittedFile && c.submittedFile.isCorrect,
    title: '제출은 했다 (상태는 몰라)',
    emoji: '😮‍💨',
    desc: '올바른 파일을 내긴 냈다. 폰트가 깨졌든 이미지가 날아갔든, 제출은 제출이다. 점수는 신만이 아신다.',
  },
  {
    id: 'perfectionist', priority: 40,
    cond: (c) => c.timeout && !c.submitted && c.state.completeness >= 80,
    title: '완벽주의로 미제출',
    emoji: '🥀',
    desc: '파일은 완벽했다. 폰트도, 이미지도, 용량도. 다만 제출 버튼을 누르지 못했을 뿐. 완벽한 0점이었다.',
  },
  {
    id: 'timeout_default', priority: 0,
    cond: () => true, // 아무 조건에도 안 걸리면 이 엔딩
    title: '결국 아무것도 제출하지 못함',
    emoji: '💀',
    desc: '시간이 다 됐다. 화면엔 여전히 열 개의 최종 파일이 떠다닌다. 진짜 최종은 끝내 찾지 못했다.',
  },
];

/* -------------------------------------------------------------------------
 * 7) 레벨(난이도) 정의
 * 레벨이 오를수록: 제한 시간↓, 파일 수↑, 함정 수↑, 사건 간격↓(=잦음), 이동 속도↑.
 * 한 레벨을 "클리어"(진짜 파일 제출 성공)하면 다음 레벨이 열립니다.
 *   time     : 제한 시간(초)
 *   files    : [최소, 최대] 파일 개수
 *   traps    : [최소, 최대] 함정 파일 개수
 *   eventGap : [최소, 최대] 사건 발생 간격(초)  ← 작을수록 자주 터짐
 *   speed    : 파일 플로팅 속도 배율
 *   mental   : 시작 멘탈
 * ---------------------------------------------------------------------- */
const LEVELS = [
  { id: 1, name: '신입생의 첫 과제',  time: 180, files: [6, 7],   traps: [1, 2], eventGap: [20, 30], speed: 0.8, mental: 90,
    tip: '천천히 파일을 살펴볼 여유가 있다. 단서 읽는 법을 익혀 보자.' },
  { id: 2, name: '새내기 탈출',       time: 160, files: [7, 8],   traps: [2, 2], eventGap: [17, 26], speed: 1.0, mental: 85,
    tip: '파일이 조금 더 많아지고 빨라진다.' },
  { id: 3, name: '중간고사 지옥',     time: 140, files: [8, 9],   traps: [2, 3], eventGap: [14, 22], speed: 1.25, mental: 80,
    tip: '사건이 자주 터지기 시작한다. 손이 빨라야 한다.' },
  { id: 4, name: '팀플의 저주',       time: 120, files: [9, 10],  traps: [3, 3], eventGap: [12, 18], speed: 1.55, mental: 72,
    tip: '팀원들이 쉴 새 없이 카톡을 보낸다. 정신 붙잡아.' },
  { id: 5, name: '졸업작품 마감',     time: 100, files: [10, 11], traps: [3, 4], eventGap: [9, 15],  speed: 1.95, mental: 65,
    tip: '마지막 관문. 파일은 총알처럼 날아다닌다. 살아남을 수 있을까.' },
];

/* 공용 유틸: 0~100 범위 클램프 */
function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

/* 다른 파일에서 쓰도록 전역에 노출 (모듈 번들러 없이 동작) */
window.GAME_DATA = {
  SUBJECTS, FILE_POOL, EVENTS, UPLOAD_EVENTS, FINAL_CHOICES, ENDINGS, LEVELS,
};
