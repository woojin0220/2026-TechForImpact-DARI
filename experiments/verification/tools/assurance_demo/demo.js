"use strict";

const sourceText = "저는 2023년 4월 시위에 참가했습니다. 이틀 뒤 경찰관 두 명이 제 집에 왔습니다. 그날 저는 집에 없었고, 이웃에게 경찰이 저를 찾았다고 들었습니다. 처음에는 경찰이 세 번 왔다고 말했지만 확인해 보니 한 번이었습니다. 경찰이 다시 올 수도 있다고 생각해 2023년 5월 2일 출국했습니다.";

const sourceEpisodes = [
  {
    episode_id: "episode-protest",
    label: "시위 참가",
    quote: "저는 2023년 4월 시위에 참가했습니다.",
    claims: [
      { claim_id: "claim-protest", rendered: "지원자는 2023년 4월 시위에 참가했다", type: "event", default_state: "confirmed" },
    ],
  },
  {
    episode_id: "episode-visit",
    label: "경찰 방문과 정보 출처",
    quote: "이틀 뒤 경찰관 두 명이 제 집에 왔습니다. 그날 저는 집에 없었고, 이웃에게 경찰이 저를 찾았다고 들었습니다.",
    claims: [
      { claim_id: "claim-visit", rendered: "이틀 뒤 경찰관 두 명이 집에 왔다", type: "event", default_state: "confirmed" },
      { claim_id: "claim-report", rendered: "지원자는 현장에 없었고 이웃에게 경찰이 자신을 찾았다는 말을 들었다", type: "evidentiality", default_state: "confirmed" },
    ],
  },
  {
    episode_id: "episode-frequency",
    label: "방문 횟수 정정",
    quote: "처음에는 경찰이 세 번 왔다고 말했지만 확인해 보니 한 번이었습니다.",
    claims: [
      { claim_id: "claim-frequency-v2", rendered: "경찰 방문 횟수는 한 번이다", type: "frequency", default_state: "corrected", supersedes: ["claim-frequency-v1"] },
    ],
  },
  {
    episode_id: "episode-departure",
    label: "귀환 가능성 우려와 출국",
    quote: "경찰이 다시 올 수도 있다고 생각해 2023년 5월 2일 출국했습니다.",
    claims: [
      { claim_id: "claim-return-possible", rendered: "경찰이 다시 올 가능성을 우려했다", type: "certainty", default_state: "confirmed" },
      { claim_id: "claim-departure", rendered: "2023년 5월 2일 출국했다", type: "date", default_state: "confirmed" },
    ],
  },
];

const supersededClaim = {
  claim_id: "claim-frequency-v1",
  episode_id: "episode-frequency",
  rendered: "경찰 방문 횟수는 세 번이다",
  type: "frequency",
  state: "superseded",
  revision: 1,
  evidence: "처음에는 경찰이 세 번 왔다고 말했지만",
};

const faithfulDraft = "신청인은 2023년 4월 시위에 참가했습니다. 이틀 뒤 경찰관 두 명이 신청인의 집을 한 번 방문했습니다. 신청인은 당시 집에 없었으며, 이웃에게 경찰이 자신을 찾았다는 말을 들었습니다. 경찰이 다시 올 가능성을 우려해 2023년 5월 2일 출국했습니다.";
const riskyDraft = "신청인은 2023년 4월 시위에 참가했습니다. 이틀 뒤 경찰관 두 명이 신청인의 집을 세 번 수색했고, 신청인은 이를 직접 목격했습니다. 경찰이 반드시 돌아올 것이라 확신해 2023년 5월 2일 출국했습니다.";

const stageIds = ["capture", "readback", "record", "builder", "gate", "export"];
const state = { reached: 0, claims: [], draftRevision: 1, findings: [], decisions: {} };
const el = (id) => document.getElementById(id);

function json(value) { return JSON.stringify(value, null, 2); }

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function span(text, quote) {
  const start = text.indexOf(quote);
  return { start, end: start < 0 ? -1 : start + quote.length, quote };
}

function regexSpan(text, pattern) {
  const match = text.match(pattern);
  return match ? span(text, match[0]) : null;
}

function showStage(id) {
  const index = stageIds.indexOf(id);
  stageIds.forEach((stageId, stageIndex) => {
    const section = el(stageId);
    section.hidden = stageId !== id;
    section.classList.toggle("active-stage", stageId === id);
    const button = document.querySelector(`.step[data-target="${stageId}"]`);
    button.classList.toggle("active", stageId === id);
    button.classList.toggle("done", stageIndex < state.reached);
  });
  if (index >= 0) el(id).scrollIntoView({ behavior: "smooth", block: "start" });
}

function advance(id) {
  state.reached = Math.max(state.reached, stageIds.indexOf(id));
  showStage(id);
}

function captureOutput() {
  const text = el("source-input").value.trim();
  const episodes = sourceEpisodes.map((episode) => ({
    episode_id: episode.episode_id,
    label: episode.label,
    evidence_span: span(text, episode.quote),
    candidate_claims: episode.claims.map(({ default_state, ...claim }) => claim),
  }));
  return {
    case_id: "synthetic-v04-001",
    language: "ko",
    source_revision: 1,
    extractor: "demo_oracle_v1",
    coverage: episodes.every((episode) => episode.evidence_span.start >= 0) ? 1 : 0,
    episodes,
  };
}

function renderEpisodes() {
  const list = el("episode-list");
  list.replaceChildren();
  sourceEpisodes.forEach((episode) => {
    episode.claims.forEach((claim) => {
      const card = document.createElement("article");
      card.className = "episode-card";
      card.innerHTML = `
        <div><h3>${episode.label}</h3><p class="episode-meta">${episode.episode_id}<br>${claim.claim_id} · ${claim.type}</p></div>
        <div><blockquote>${episode.quote}</blockquote><p><b>추출된 의미</b><br>${claim.rendered}</p></div>
        <label>지원자 확인 상태
          <select data-claim-id="${claim.claim_id}">
            <option value="confirmed" ${claim.default_state === "confirmed" ? "selected" : ""}>의미가 맞음</option>
            <option value="corrected" ${claim.default_state === "corrected" ? "selected" : ""}>정정 후 맞음</option>
            <option value="uncertain">판단하기 어려움</option>
            <option value="withdrawn">철회함</option>
          </select>
        </label>`;
      list.append(card);
    });
  });
}

function buildLedger() {
  const text = el("source-input").value.trim();
  const claims = [];
  sourceEpisodes.forEach((episode) => episode.claims.forEach((candidate) => {
    const selected = document.querySelector(`select[data-claim-id="${candidate.claim_id}"]`).value;
    claims.push({
      claim_id: candidate.claim_id,
      episode_id: episode.episode_id,
      type: candidate.type,
      meaning: candidate.rendered,
      state: selected,
      active: selected === "confirmed" || selected === "corrected",
      revision: candidate.claim_id === "claim-frequency-v2" ? 2 : 1,
      supersedes: candidate.supersedes || [],
      evidence: span(text, episode.quote),
      confirmation: { language: "ko", actor: "demo_user", method: "episode_readback" },
    });
  }));
  claims.push(supersededClaim);
  state.claims = claims;
  return claims;
}

function renderLedger() {
  const list = el("ledger-list");
  list.replaceChildren();
  state.claims.forEach((claim) => {
    const row = document.createElement("div");
    row.className = `ledger-row${claim.state === "superseded" ? " superseded" : ""}`;
    const badgeClass = claim.active ? "good" : claim.state === "superseded" ? "warning" : "waiting";
    row.innerHTML = `<div class="row-head"><code>${claim.claim_id}</code><span class="status ${badgeClass}">${claim.state}</span></div><p>${claim.meaning || claim.rendered}</p>`;
    list.append(row);
  });
  const active = state.claims.filter((claim) => claim.active);
  el("active-count").textContent = `${active.length} active`;
  el("ledger-json").textContent = json({
    case_record_id: "case-record-demo-001",
    version: 2,
    controller: "applicant",
    active_claim_ids: active.map((claim) => claim.claim_id),
    claims: state.claims,
    export_policy: { raw_conversation: "excluded_by_default", superseded_history: "excluded_by_default" },
  });
}

function active(id) { return state.claims.some((claim) => claim.claim_id === id && claim.active); }

function generateDraft() {
  const sentences = [];
  if (active("claim-protest")) sentences.push({ text: "신청인은 2023년 4월 시위에 참가했습니다.", claim_ids: ["claim-protest"] });
  if (active("claim-visit") || active("claim-frequency-v2")) sentences.push({ text: "이틀 뒤 경찰관 두 명이 신청인의 집을 한 번 방문했습니다.", claim_ids: ["claim-visit", "claim-frequency-v2"].filter(active) });
  if (active("claim-report")) sentences.push({ text: "신청인은 당시 집에 없었으며, 이웃에게 경찰이 자신을 찾았다는 말을 들었습니다.", claim_ids: ["claim-report"] });
  if (active("claim-return-possible") || active("claim-departure")) sentences.push({ text: "경찰이 다시 올 가능성을 우려해 2023년 5월 2일 출국했습니다.", claim_ids: ["claim-return-possible", "claim-departure"].filter(active) });
  const text = sentences.map((item) => item.text).join(" ");
  el("draft-input").value = text;
  state.draftRevision = 1;
  el("draft-revision").textContent = "revision 1";
  renderArtifact(sentences, text);
}

function renderArtifact(sentences, text) {
  const list = el("lineage-list");
  list.replaceChildren();
  sentences.forEach((sentence, index) => {
    const block = document.createElement("div");
    block.className = "lineage";
    const claimPath = sentence.claim_ids.map((claimId) => `<span>${claimId}</span>`).join("<i>+</i>");
    block.innerHTML = `<b>sentence-${index + 1}</b><p>${sentence.text}</p><div class="lineage-path"><span>source evidence</span><i>→</i>${claimPath}<i>→</i><span>sentence-${index + 1}</span></div>`;
    list.append(block);
  });
  el("artifact-json").textContent = json({
    artifact_id: "korean-draft-demo-001",
    revision: state.draftRevision,
    generator: "deterministic_template_demo",
    semantic_contract: "question-14-demo-v1",
    sentences,
    digest: hashText(text),
  });
}

function finding(id, type, risk, claimId, observed, sourceQuote, candidateSpan, detector) {
  return {
    finding_id: id,
    type,
    risk,
    claim_id: claimId,
    observed_change: observed,
    source_evidence: { quote: sourceQuote },
    artifact_evidence: candidateSpan,
    detector,
    status: "open",
  };
}

function verifyDraft(text) {
  const findings = [];
  const frequencyStale = regexSpan(text, /(?:세 번|3회|세 차례)/);
  if (frequencyStale) findings.push(finding(
    "finding-stale-frequency", "changed", "critical", "claim-frequency-v2",
    "정정된 방문 횟수 1회가 정정 전 값 3회로 바뀌었습니다.",
    "확인해 보니 한 번이었습니다.", frequencyStale, "deterministic_superseded_guard",
  ));
  if (!frequencyStale && active("claim-frequency-v2") && !/(?:한 번|1회|한 차례)/.test(text)) findings.push(finding(
    "finding-frequency-omission", "removed", "high", "claim-frequency-v2",
    "확인된 방문 횟수가 최종 문서에서 빠졌습니다.",
    "확인해 보니 한 번이었습니다.", null, "deterministic_claim_coverage",
  ));

  const searchAdded = regexSpan(text, /(?:집을 |집을 직접 |주거지를 )?수색(?:했고|했습니다|했다)?/);
  if (searchAdded) findings.push(finding(
    "finding-search-added", "added", "high", null,
    "원문에는 경찰이 찾았다고 되어 있지만 집을 수색했다는 사건이 추가됐습니다.",
    "이웃에게 경찰이 저를 찾았다고 들었습니다.", searchAdded, "flat_claim_delta",
  ));

  const directExperience = regexSpan(text, /(?:직접 목격했습니다|직접 보았습니다|직접 봤습니다)/);
  if (directExperience) findings.push(finding(
    "finding-evidentiality", "changed", "critical", "claim-report",
    "이웃에게 들은 전언이 지원자의 직접 목격으로 바뀌었습니다.",
    "그날 저는 집에 없었고, 이웃에게 경찰이 저를 찾았다고 들었습니다.", directExperience, "relational_reporting_guard",
  ));
  if (active("claim-report") && !/(?:이웃).{0,18}(?:들었|말을 들)/.test(text) && !directExperience) findings.push(finding(
    "finding-report-omission", "removed", "high", "claim-report",
    "정보 출처인 이웃과 전언 관계가 최종 문서에서 빠졌습니다.",
    "이웃에게 경찰이 저를 찾았다고 들었습니다.", null, "flat_claim_coverage",
  ));

  const certainty = regexSpan(text, /(?:반드시|확신(?:해|했|하))/);
  if (certainty) findings.push(finding(
    "finding-certainty", "changed", "high", "claim-return-possible",
    "가능성에 대한 우려가 확정적인 예측으로 강화됐습니다.",
    "경찰이 다시 올 수도 있다고 생각해", certainty, "scoped_certainty_guard",
  ));
  if (active("claim-departure") && !/(?:2023년\s*)?5월\s*2일/.test(text)) findings.push(finding(
    "finding-date-omission", "removed", "high", "claim-departure",
    "확인된 출국 날짜가 최종 문서에서 빠졌습니다.",
    "2023년 5월 2일 출국했습니다.", null, "deterministic_date_guard",
  ));
  if (active("claim-protest") && !/시위.{0,18}참가/.test(text)) findings.push(finding(
    "finding-protest-omission", "removed", "high", "claim-protest",
    "시위 참가 claim이 최종 문서에서 빠졌습니다.",
    "2023년 4월 시위에 참가했습니다.", null, "deterministic_claim_coverage",
  ));
  return findings;
}

function renderCascade(findings) {
  const hasRelational = findings.some((item) => item.detector === "relational_reporting_guard");
  const steps = [
    ["1", "Deterministic invariant", "coverage · 숫자 · 날짜 · superseded", "ran"],
    ["2", "Flat claim delta", "누락 · 추가 · 일반 의미 변화", "ran"],
    ["3", "Relational micrograph", "전언과 직접 경험 관계", hasRelational ? "ran" : "skipped"],
    ["4", "Independent verifier", "다른 model family", "skipped"],
    ["5", "Human escalation", "중요하거나 불확실한 변화", findings.length ? "escalated" : "skipped"],
  ];
  el("cascade").innerHTML = steps.map(([number, name, description, status]) => `<div class="cascade-step ${status}"><strong>${number} · ${name}</strong><span>${description}</span><span class="status ${status === "escalated" ? "problem" : status === "ran" ? "good" : "waiting"}">${status}</span></div>`).join("");
}

function renderFindings() {
  const list = el("finding-list");
  list.replaceChildren();
  if (!state.findings.length) {
    list.innerHTML = '<div class="empty">중요한 의미 변화가 발견되지 않았습니다.</div>';
  } else {
    state.findings.forEach((item) => {
      const card = document.createElement("article");
      card.className = "finding-card";
      card.innerHTML = `<h4>${item.type} · ${item.risk} · ${item.finding_id}</h4><div class="evidence-pair"><div><b>확인된 원문 근거</b>${item.source_evidence.quote}</div><div><b>현재 문서 근거</b>${item.artifact_evidence?.quote || "대응 표현 없음"}</div></div><p>${item.observed_change}</p><p class="episode-meta">${item.detector}</p>`;
      list.append(card);
    });
  }
  const status = state.findings.length ? "human_review" : "pass";
  el("finding-count").textContent = `${state.findings.length} findings`;
  el("finding-count").className = `status ${state.findings.length ? "problem" : "good"}`;
  el("gate-status").textContent = status;
  el("gate-status").className = `status ${state.findings.length ? "problem" : "good"}`;
  el("gate-json").textContent = json({
    artifact_revision: state.draftRevision,
    artifact_digest: hashText(el("draft-input").value),
    route: status,
    independent_verifier_called: false,
    findings: state.findings,
  });
}

function renderReview() {
  const list = el("review-list");
  list.replaceChildren();
  if (!state.findings.length) {
    list.innerHTML = '<div class="empty">검토가 필요한 변화가 없습니다. 바로 export할 수 있습니다.</div>';
  } else {
    state.findings.forEach((item) => {
      const card = document.createElement("article");
      card.className = "review-card";
      const decision = state.decisions[item.finding_id] || "open";
      card.innerHTML = `<h4>${item.observed_change}</h4><div class="evidence-pair"><div><b>원문</b>${item.source_evidence.quote}</div><div><b>문서</b>${item.artifact_evidence?.quote || "대응 표현 없음"}</div></div><div class="review-actions" data-finding-id="${item.finding_id}">${["corrected", "accepted", "rejected", "deferred"].map((value) => `<button data-decision="${value}" class="${decision === value ? "selected" : ""}">${{ corrected: "수정함", accepted: "변화 수락", rejected: "오탐", deferred: "조력자 보류" }[value]}</button>`).join("")}</div>`;
      list.append(card);
    });
  }
  updateReceipt();
}

function updateReceipt() {
  const unresolved = state.findings.filter((item) => !state.decisions[item.finding_id] || state.decisions[item.finding_id] === "deferred");
  const ready = unresolved.length === 0;
  el("export-status").textContent = ready ? "READY" : "BLOCKED";
  el("export-status").className = `status ${ready ? "good" : "problem"}`;
  el("export-message").textContent = ready
    ? "모든 중요 변화가 처리됐습니다. 최종 문서와 제한된 receipt를 내보낼 수 있습니다."
    : `${unresolved.length}개의 중요 변화가 해결되지 않아 최종 export를 보류합니다.`;
  el("receipt-json").textContent = json({
    case_record_id: "case-record-demo-001",
    artifact: { revision: state.draftRevision, digest: hashText(el("draft-input").value) },
    review_status: ready ? "complete" : "blocked",
    decisions: state.findings.map((item) => ({ finding_id: item.finding_id, decision: state.decisions[item.finding_id] || "open" })),
    excluded_from_export: ["raw_conversation", "superseded_claim_history", "internal_model_trace"],
  });
}

function reset() {
  state.reached = 0;
  state.claims = [];
  state.draftRevision = 1;
  state.findings = [];
  state.decisions = {};
  el("source-input").value = sourceText;
  el("capture-json").textContent = "분석을 실행하면 episode와 evidence span이 표시됩니다.";
  el("capture-status").textContent = "대기";
  el("capture-status").className = "status waiting";
  showStage("capture");
}

document.querySelectorAll(".step").forEach((button) => button.addEventListener("click", () => {
  const target = button.dataset.target;
  if (stageIds.indexOf(target) <= state.reached) showStage(target);
}));

el("analyze-button").addEventListener("click", () => {
  el("capture-json").textContent = json(captureOutput());
  el("capture-status").textContent = "4 episodes · coverage 100%";
  el("capture-status").className = "status good";
  renderEpisodes();
  advance("readback");
});
el("reset-button").addEventListener("click", reset);
el("confirm-button").addEventListener("click", () => { buildLedger(); renderLedger(); advance("record"); });
el("draft-button").addEventListener("click", () => { generateDraft(); advance("builder"); });
el("faithful-preset").addEventListener("click", () => { el("draft-input").value = faithfulDraft; state.draftRevision = 2; el("draft-revision").textContent = "revision 2"; });
el("risky-preset").addEventListener("click", () => { el("draft-input").value = riskyDraft; state.draftRevision = 2; el("draft-revision").textContent = "revision 2"; });
el("draft-input").addEventListener("input", () => { state.draftRevision = 2; el("draft-revision").textContent = "revision 2 · edited"; });
el("verify-button").addEventListener("click", () => {
  state.findings = verifyDraft(el("draft-input").value);
  state.decisions = {};
  renderCascade(state.findings);
  renderFindings();
  advance("gate");
});
el("review-button").addEventListener("click", () => { renderReview(); advance("export"); });
el("review-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-decision]");
  if (!button) return;
  const group = button.closest(".review-actions");
  state.decisions[group.dataset.findingId] = button.dataset.decision;
  group.querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button));
  updateReceipt();
});

reset();
