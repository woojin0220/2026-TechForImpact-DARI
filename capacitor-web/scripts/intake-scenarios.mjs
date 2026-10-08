// Fictional test conversations for question 14 metadata collection.
// Every story is invented for testing; do not use real applicant statements.
// Turns can be pasted into the chat one by one (Korean, full form scope).
//
// Checks (run by scripts/run-intake-scenarios.mjs):
//   gate      { gate, value }                     applicant's yes/no for a group
//   events    { group, count }                    number of separate incidents/entries
//   has       { field, includes, event? }         an answered value contains text (event = 1-based order)
//   lacks     { field, includes, event? }         no answered value contains text (e.g. leaked from another incident)
//   notAnswered { field, event? }                 not recorded as an answered fact (missing/unknown/skipped is fine)
//   status    { field, in: [...] , event? }       fact status
//   knowledge { field, in: [...], event? }        direct / heard / inferred
//   derived   { id, value }                       computed question 14 box
// draft (optional): [{ question, has?: [...], lacks?: [...] }] checks on the Korean draft section.

export const scenarios = [
  {
    id: 'basic',
    title: '기본: 한 사건, 대략적인 날짜, 귀국 시 우려',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 정치적 의견 때문에 보호를 신청합니다. 2024년 가을쯤 정부를 비판하는 글을 인터넷에 올린 뒤 경찰이 집에 찾아와서 그 글에 대해 두 시간 동안 조사했습니다. 돌아가면 다시 붙잡혀 갈까 두렵습니다.',
    ],
    checks: [
      { has: { field: 'grounds.category', includes: 'political' } },
      { gate: { gate: 'harm', value: 'yes' } },
      { events: { group: 'harm', count: 1 } },
      { has: { field: 'harm.time', includes: '가을' } },
      { has: { field: 'harm.type', includes: 'questioning' } },
      { gate: { gate: 'fear', value: 'yes' } },
      { derived: { id: '14.2', value: '예' } },
    ],
    // "글을 올린 뒤" is a sequence; the draft must not turn it into a cause.
    draft: [{ question: '14.2', has: ['가을'], lacks: ['때문에', '이 일로 인해'] }],
  },
  {
    id: 'two-incidents',
    title: '여러 사건: 사건별 정보가 섞이지 않아야 함',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 종교 때문에 신청합니다. 2023년 겨울에 교회 예배 중 경찰이 들어와 저를 체포했고 사흘 동안 구금됐다가 풀려났습니다. 그때 맞지는 않았습니다.',
      '그리고 2024년 5월쯤에는 집 앞에서 모르는 남자 두 명이 저를 때렸습니다. 그 사람들이 누구인지, 왜 그랬는지는 모릅니다.',
    ],
    checks: [
      { events: { group: 'harm', count: 2 } },
      { has: { field: 'harm.type', includes: 'detention', event: 1 } },
      { lacks: { field: 'harm.type', includes: 'assault', event: 1 } },
      { has: { field: 'harm.type', includes: 'assault', event: 2 } },
      { has: { field: 'harm.time', includes: '2024', event: 2 } },
      { notAnswered: { field: 'harm.reason', event: 2 } },
    ],
  },
  {
    id: 'correction',
    title: '정정: 날짜를 바로잡으면 이전 값이 대체되어야 함',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 정치적 의견 때문에 신청합니다. 2025년 3월쯤 시위에 나갔다가 경찰서로 끌려가 조사를 받았습니다.',
      '아까 3월이라고 했는데 잘못 말했습니다. 4월이었습니다.',
    ],
    checks: [
      { events: { group: 'harm', count: 1 } },
      { has: { field: 'harm.time', includes: '4월' } },
      { lacks: { field: 'harm.time', includes: '3월' } },
    ],
    draft: [{ question: '14.2', has: ['4월'], lacks: ['3월'] }],
  },
  {
    id: 'refinement',
    title: '구체화: 더 자세히 다시 말한 내용은 충돌이 아니라 갱신',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 정치적 의견 때문에 신청합니다. 작년에 경찰이 제 집에 와서 저를 위협했습니다.',
      '그 집은 가상의 도시 B에 있는 우리 가족 아파트였습니다.',
    ],
    checks: [
      { events: { group: 'harm', count: 1 } },
      { has: { field: 'harm.place', includes: '도시 B' } },
      { status: { field: 'harm.place', in: ['answered'] } },
    ],
  },
  {
    id: 'hearsay-family',
    title: '전해 들은 가족 피해: 본인 사건과 분리, 전해 들음으로 기록',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 소수민족이라는 이유로 보호를 신청합니다. 저 자신은 직접 피해를 입은 적은 없습니다.',
      '하지만 제 형은 2024년에 같은 민족 모임에 갔다가 군인들에게 끌려가 일주일 동안 갇혀 있었다고 어머니에게 전화로 들었습니다.',
    ],
    checks: [
      { gate: { gate: 'harm', value: 'no' } },
      { events: { group: 'harm', count: 0 } },
      { gate: { gate: 'family_harm', value: 'yes' } },
      { events: { group: 'family_harm', count: 1 } },
      { has: { field: 'family_harm.person', includes: '형' } },
      { knowledge: { field: 'family_harm.event', in: ['heard'] } },
      { derived: { id: '14.4', value: '예' } },
    ],
  },
  {
    id: 'narrow-denial',
    title: '좁은 부정: "때리거나 가두진 않았다"가 피해 없음이 되면 안 됨',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 정치적 의견 때문에 신청합니다. 경찰이 저를 때리거나 가두지는 않았습니다. 다만 2024년 여름에 세 번 정도 경찰서에 불려가 제가 속한 정당 활동에 대해 조사를 받았고, 계속하면 가만두지 않겠다는 말을 들었습니다.',
    ],
    checks: [
      { gate: { gate: 'harm', value: 'yes' } },
      { has: { field: 'harm.type', includes: 'questioning' } },
      { lacks: { field: 'harm.type', includes: 'assault' } },
      { lacks: { field: 'harm.type', includes: 'detention' } },
      { derived: { id: '14.2', value: '예' } },
    ],
  },
  {
    id: 'unknown-and-refusal',
    title: '모름·말하기 어려움: 추측하지 않고 그대로 기록',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 종교 때문에 신청합니다. 경찰에 붙잡혀 간 적이 있는데 정확히 언제였는지는 기억나지 않습니다.',
      '붙잡혀 있는 동안 있었던 일은 지금은 말하고 싶지 않습니다.',
    ],
    checks: [
      { gate: { gate: 'harm', value: 'yes' } },
      { status: { field: 'harm.time', in: ['unknown'] } },
      { lacks: { field: 'harm.event', includes: '말하고 싶지' } },
    ],
    draft: [{ question: '14.2', has: ['기억'] }],
  },
  {
    id: 'no-category',
    title: '사유 범주를 추정하지 않음: 신청인이 이유를 모를 때',
    turns: [
      '이것은 시험용 가상 이야기입니다. 무장한 사람들이 우리 마을에 와서 집을 불태웠고, 저도 위협을 받아 도망쳤습니다. 왜 우리 마을이 공격받았는지는 잘 모르겠습니다.',
    ],
    checks: [
      { notAnswered: { field: 'grounds.category' } },
      { gate: { gate: 'harm', value: 'yes' } },
      { notAnswered: { field: 'harm.reason' } },
    ],
  },
  {
    id: 'protection-relocation',
    title: '보호 요청을 안 한 이유와 국내 피신',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 정치적 의견 때문에 신청합니다. 2024년에 시위에 참여한 뒤 경찰에게 위협을 받았습니다.',
      '경찰이 위협한 당사자라서 경찰에 도움을 요청할 수 없었습니다. 그래서 2024년 10월에 다른 도시의 삼촌 집으로 피신했는데, 두 달 뒤 경찰이 그곳에도 저를 찾으러 와서 다시 떠나야 했습니다.',
    ],
    checks: [
      { gate: { gate: 'protection', value: 'no' } },
      { has: { field: 'protection.no_reason', includes: '경찰' } },
      { gate: { gate: 'relocation', value: 'yes' } },
      { events: { group: 'relocation', count: 1 } },
      { has: { field: 'relocation.destination', includes: '삼촌' } },
      { derived: { id: '14.5', value: '아니요' } },
      { derived: { id: '14.6', value: '예' } },
    ],
  },
  {
    id: 'children',
    title: '자녀 동반: 자녀별로 나이와 관계',
    turns: [
      '이것은 시험용 가상 이야기입니다. 저는 종교 때문에 신청합니다. 이번 신청은 8살 딸과 함께 했습니다. 아이 아빠인 남편도 한국에 같이 있습니다.',
    ],
    checks: [
      { gate: { gate: 'minor', value: 'yes' } },
      { events: { group: 'minor', count: 1 } },
      { has: { field: 'minor.age', includes: '8' } },
      { has: { field: 'minor.role', includes: 'both_parents' } },
    ],
  },
];
