"use strict";

const state = { caseId: null, signature: null, timer: null };
const el = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";

const MODULE_LABELS = {
  M0_input_contract: ["M0", "Input Contract"],
  M1_graph_extractor: ["M1", "Graph Extractor"],
  M2_graph_validator: ["M2", "Graph Validator"],
  M3_cross_lingual_aligner: ["M3", "Cross-lingual Aligner"],
  M4_typed_comparator: ["M4", "Typed Comparator"],
  M5_targeted_confirmer: ["M5", "Targeted Confirmer"],
  M6_report_adapter: ["M6", "Report Adapter"],
};

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

function moduleSummary(key, module) {
  const output = module.output || {};
  if (key === "M0_input_contract") return `${output.case_id || "case"} · valid`;
  if (key === "M1_graph_extractor") {
    const source = output.source_graph || { nodes: [], edges: [], qualifiers: [] };
    const translation = output.translation_graph || { nodes: [], edges: [], qualifiers: [] };
    return `source ${source.nodes.length}/${source.edges.length}/${source.qualifiers.length} · translation ${translation.nodes.length}/${translation.edges.length}/${translation.qualifiers.length}`;
  }
  if (key === "M2_graph_validator") return `source ${output.source?.status || "?"} · translation ${output.translation?.status || "?"}`;
  if (key === "M3_cross_lingual_aligner") return `${output.event_alignments?.length || 0} event alignments · unaligned ${(output.unaligned_source_ids?.length || 0) + (output.unaligned_translation_ids?.length || 0)}`;
  if (key === "M4_typed_comparator") return `${output.candidate_diffs?.length || 0} candidates · ${output.preserved_units?.length || 0} preserved`;
  if (key === "M5_targeted_confirmer") return output.called ? `${output.decisions?.length || 0} decisions` : "not called";
  if (key === "M6_report_adapter") return `${output.report_status || "?"} · ${output.finding_ids?.length || 0} findings`;
  return "";
}

function renderModules(modules) {
  const grid = el("module-grid");
  grid.replaceChildren();
  Object.entries(MODULE_LABELS).forEach(([key, [index, name]]) => {
    const module = modules[key] || {};
    const card = create("article", "module-card");
    card.append(create("span", "module-index", index));
    card.append(create("div", "module-name", name));
    card.append(create("p", "module-summary", moduleSummary(key, module)));
    const details = create("details");
    details.append(create("summary", "", "actual input / output"));
    details.append(create("pre", "", jsonText({ input: module.input, output: module.output })));
    card.append(details);
    grid.append(card);
  });
}

function findingElementIds(comparison, document) {
  const key = document === "source" ? "source_element_ids" : "translation_element_ids";
  return new Set((comparison.candidate_diffs || []).flatMap((item) => item[key] || []));
}

function graphLayout(graph) {
  const groups = { entity: [], event: [], value: [] };
  graph.nodes.forEach((node) => groups[node.kind]?.push(node));
  const height = Math.max(540, ...Object.values(groups).map((items) => items.length * 78 + 80));
  const columns = { entity: 110, event: 380, value: 650 };
  const positions = new Map();
  Object.entries(groups).forEach(([kind, nodes]) => {
    const gap = height / (nodes.length + 1);
    nodes.forEach((node, index) => positions.set(node.id, { x: columns[kind], y: gap * (index + 1), kind }));
  });
  return { height, positions };
}

function evidenceText(element) {
  return (element.evidence_spans || []).map((span) => `“${span.quote}”`).join(" · ") || "evidence 없음";
}

function renderElementDetail(node, graph) {
  const qualifiers = graph.qualifiers.filter((item) => item.target_id === node.id);
  const values = qualifiers.map((item) => `${item.type}=${item.value}`).join(" · ") || "qualifier 없음";
  el("element-detail").textContent = `${node.id} | ${node.kind}:${node.semantic_type} | ${values} | evidence ${evidenceText(node)}`;
}

function renderGraph(containerId, graph, changedIds) {
  const container = el(containerId);
  container.replaceChildren();
  const { height, positions } = graphLayout(graph);
  const canvas = svg("svg", { viewBox: `0 0 760 ${height}`, role: "img", "aria-label": `${graph.document} document graph` });
  const defs = svg("defs");
  const marker = svg("marker", { id: `arrow-${graph.document}`, markerWidth: 8, markerHeight: 8, refX: 7, refY: 3, orient: "auto", markerUnits: "strokeWidth" });
  marker.append(svg("path", { d: "M0,0 L0,6 L7,3 z", fill: "#8aa0b8" }));
  defs.append(marker);
  canvas.append(defs);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const qualifierById = new Map(graph.qualifiers.map((item) => [item.id, item]));
  const expandedChanged = new Set(changedIds);
  changedIds.forEach((id) => {
    const qualifier = qualifierById.get(id);
    if (qualifier) expandedChanged.add(qualifier.target_id);
  });

  graph.edges.forEach((edge, index) => {
    const start = positions.get(edge.source_id);
    const end = positions.get(edge.target_id);
    if (!start || !end) return;
    const bend = 28 + (index % 4) * 12;
    const direction = start.y <= end.y ? -1 : 1;
    const controlX = (start.x + end.x) / 2;
    const controlY = (start.y + end.y) / 2 + bend * direction;
    const isChanged = expandedChanged.has(edge.id) || expandedChanged.has(edge.source_id) || expandedChanged.has(edge.target_id);
    const path = svg("path", {
      d: `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`,
      class: `graph-edge${isChanged ? " changed" : ""}`,
      "marker-end": `url(#arrow-${graph.document})`,
    });
    canvas.append(path);
    const label = svg("text", { x: controlX, y: controlY - 4, class: "edge-label" });
    label.textContent = edge.type;
    canvas.append(label);
  });

  graph.nodes.forEach((node) => {
    const pos = positions.get(node.id);
    const changed = expandedChanged.has(node.id);
    const group = svg("g", { class: `graph-node ${node.kind}${changed ? " changed" : ""}`, role: "button", "aria-label": `${node.semantic_type}: ${node.surface}` });
    if (node.kind === "entity") group.append(svg("ellipse", { cx: pos.x, cy: pos.y, rx: 62, ry: 29 }));
    if (node.kind === "event") group.append(svg("rect", { x: pos.x - 78, y: pos.y - 29, width: 156, height: 58, rx: 24 }));
    if (node.kind === "value") group.append(svg("polygon", { points: `${pos.x},${pos.y - 34} ${pos.x + 68},${pos.y} ${pos.x},${pos.y + 34} ${pos.x - 68},${pos.y}` }));
    const title = svg("text", { x: pos.x, y: pos.y - 5 });
    title.textContent = node.semantic_type;
    const subtitle = svg("text", { x: pos.x, y: pos.y + 12, class: "node-subtitle" });
    subtitle.textContent = String(node.surface || "").slice(0, 22);
    group.append(title, subtitle);
    group.addEventListener("click", () => renderElementDetail(node, graph));
    canvas.append(group);
  });
  container.append(canvas);
  return nodeById;
}

function appendHighlightedText(container, text, spans) {
  container.replaceChildren();
  const ordered = spans
    .filter((span) => span && Number.isInteger(span.start) && Number.isInteger(span.end))
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  ordered.forEach((span) => {
    if (span.start < cursor) return;
    container.append(document.createTextNode(text.slice(cursor, span.start)));
    const mark = create("mark", "", text.slice(span.start, span.end));
    container.append(mark);
    cursor = span.end;
  });
  container.append(document.createTextNode(text.slice(cursor)));
}

function renderAlignments(output) {
  const list = el("alignment-list");
  list.replaceChildren();
  const alignments = output.event_alignments || [];
  el("alignment-count").textContent = `${alignments.length} event units`;
  alignments.forEach((item) => {
    const row = create("div", "alignment-row");
    row.append(create("code", "", item.source_ids.join(" + ")));
    row.append(create("span", "alignment-arrow", "↔"));
    row.append(create("code", "", item.translation_ids.join(" + ")));
    row.append(create("span", "badge good", item.cardinality));
    list.append(row);
  });
}

function renderFindings(report) {
  const panel = el("final-result");
  const list = el("finding-list");
  const status = report?.status || "report 없음";
  el("report-status").textContent = status;
  panel.classList.toggle("issues", status === "issues_found");
  panel.classList.toggle("clean", status === "completed");
  list.replaceChildren();
  if (!report?.findings?.length) {
    list.append(create("p", "empty-state", status === "completed" ? "검출된 의미 변화가 없습니다." : "finding이 없습니다."));
    return;
  }
  report.findings.forEach((finding) => {
    const article = create("article", "finding");
    article.append(create("h4", "", `${finding.type} · ${finding.status} · ${finding.severity}`));
    article.append(create("p", "", `Source: “${finding.source_span?.quote || "—"}”`));
    article.append(create("p", "", `Translation: “${finding.translation_span?.quote || "—"}”`));
    if (finding.related_types?.length) article.append(create("p", "", `Related: ${finding.related_types.join(", ")}`));
    article.append(create("p", "", finding.rationale || ""));
    list.append(article);
  });
}

function renderCase(payload) {
  const { trace, report } = payload;
  const modules = trace.modules;
  const input = modules.M0_input_contract.output;
  const graphs = modules.M1_graph_extractor.output;
  const comparison = modules.M4_typed_comparator.output;

  el("case-id").textContent = trace.case_id;
  el("case-title").textContent = trace.title;
  el("case-purpose").textContent = trace.purpose;
  el("source-language").textContent = input.source.language;
  el("translation-language").textContent = input.translation.language;
  const sourceSpans = (report?.findings || []).map((item) => item.source_span);
  const translationSpans = (report?.findings || []).map((item) => item.translation_span);
  appendHighlightedText(el("source-text"), input.source.text, sourceSpans);
  appendHighlightedText(el("translation-text"), input.translation.text, translationSpans);

  const badges = el("case-badges");
  badges.replaceChildren();
  badges.append(create("span", "badge", trace.mode));
  badges.append(create("span", `badge ${trace.model_used ? "problem" : "good"}`, trace.model_used ? "model used" : "model-free"));
  badges.append(create("span", `badge ${report?.status === "issues_found" ? "problem" : "good"}`, report?.status || "no report"));

  renderModules(modules);
  const sourceGraph = graphs.source_graph;
  const translationGraph = graphs.translation_graph;
  el("source-counts").textContent = `${sourceGraph.nodes.length} nodes · ${sourceGraph.edges.length} edges`;
  el("translation-counts").textContent = `${translationGraph.nodes.length} nodes · ${translationGraph.edges.length} edges`;
  renderGraph("source-graph", sourceGraph, findingElementIds(comparison, "source"));
  renderGraph("translation-graph", translationGraph, findingElementIds(comparison, "translation"));
  el("element-detail").textContent = "노드를 선택하면 semantic type, qualifier, evidence를 표시합니다.";
  renderAlignments(modules.M3_cross_lingual_aligner.output);
  renderFindings(report);
  el("updated-at").textContent = `마지막 확인 ${new Date().toLocaleTimeString("ko-KR")}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function showError(error) {
  const banner = el("error-banner");
  banner.textContent = error.message || String(error);
  banner.hidden = false;
  el("live-text").textContent = "연결 오류";
}

async function loadSelected(force = false) {
  if (!state.caseId) return;
  try {
    const payload = await fetchJson(`/api/cases/${encodeURIComponent(state.caseId)}`);
    const signature = JSON.stringify(payload);
    if (force || signature !== state.signature) {
      state.signature = signature;
      renderCase(payload);
    } else {
      el("updated-at").textContent = `변경 없음 · ${new Date().toLocaleTimeString("ko-KR")}`;
    }
    el("error-banner").hidden = true;
    el("live-text").textContent = "Live trace 연결됨";
  } catch (error) {
    showError(error);
  }
}

async function loadCases() {
  try {
    const { cases } = await fetchJson("/api/cases");
    const select = el("case-select");
    const previous = state.caseId;
    select.replaceChildren();
    cases.forEach((item) => {
      const option = create("option", "", `${item.title} (${item.case_id})`);
      option.value = item.case_id;
      select.append(option);
    });
    state.caseId = cases.some((item) => item.case_id === previous)
      ? previous
      : cases.find((item) => item.case_id === "demo-paragraph-certainty")?.case_id || cases[0]?.case_id || null;
    if (state.caseId) select.value = state.caseId;
    if (!cases.length) throw new Error("trace 파일이 없습니다. 먼저 graph demo를 실행하세요.");
    await loadSelected(true);
  } catch (error) {
    showError(error);
  }
}

el("case-select").addEventListener("change", (event) => {
  state.caseId = event.target.value;
  state.signature = null;
  loadSelected(true);
});
el("refresh-button").addEventListener("click", () => loadSelected(true));
state.timer = window.setInterval(() => {
  if (el("auto-refresh").checked) loadSelected(false);
}, 2000);
loadCases();
