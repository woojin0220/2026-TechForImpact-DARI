"""Rebuild comparison tables from recorded model outputs; no model calls."""
import argparse
import json
from pathlib import Path
import statistics


def summarize(rows):
    usable = [r for r in rows if r["status"] == "ok"]
    totals = {key: sum(r["metrics"][key] for r in usable) for key in ["tp", "fp", "fn", "covered_entities", "entities"]}
    divide = lambda a, b: round(a / b, 6) if b else None
    times = sorted(t for r in usable for t in r["latency_ms"])
    return {**totals, "samples": len(usable),
            "entity_recall": divide(totals["covered_entities"], totals["entities"]),
            "char_precision": divide(totals["tp"], totals["tp"] + totals["fp"]),
            "char_recall": divide(totals["tp"], totals["tp"] + totals["fn"]),
            "leak_free_samples": sum(r["metrics"]["leak_free"] for r in usable),
            "positive_samples": sum(bool(r["gold"]) for r in usable),
            "positive_leak_free_samples": sum(r["metrics"]["leak_free"] for r in usable if r["gold"]),
            "negative_samples": sum(not r["gold"] for r in usable),
            "negative_samples_overmasked": sum(bool(r["predictions"]) for r in usable if not r["gold"]),
            "repeat_inconsistencies": sum(not r["repeat_consistent"] for r in usable),
            "p50_ms": round(statistics.median(times), 2) if times else None,
            "p90_ms": round(times[min(len(times) - 1, int(len(times) * .9))], 2) if times else None}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("directory", type=Path)
    args = p.parse_args()
    report = []
    for path in sorted(args.directory.glob("*.json")):
        model = json.loads(path.read_text())
        if "model" not in model or "rows" not in model:
            continue
        for threshold in dict.fromkeys(row["threshold"] for row in model["rows"]):
            own = [r for r in model["rows"] if r["threshold"] == threshold and r["track"] == "identifiers"]
            sensitive = [r for r in model["rows"] if r["threshold"] == threshold and r["track"] == "sensitive"]
            per_type = {}
            for row in own:
                if row["status"] != "ok":
                    continue
                for gold, covered in zip(row["gold"], row["metrics"]["fully_covered"]):
                    value = per_type.setdefault(gold["label"], {"covered": 0, "total": 0})
                    value["covered"] += covered
                    value["total"] += 1
            report.append({"model": model["model"], "threshold": threshold,
                           "status": model.get("status"), "summary": summarize(own),
                           "languages": {lang: summarize([r for r in own if r["language"] == lang])
                                         for lang in ["ko", "en", "fr", "ru", "ar", "fa"]},
                           "types": per_type,
                           "sensitive_probe": summarize(sensitive) if any(r["status"] == "ok" for r in sensitive) else "unsupported taxonomy",
                           "load_seconds": model.get("load_seconds"), "rss_after_load_mb": model.get("rss_after_load_mb"),
                           "misses": [{"id": r["id"], "text": r["text"],
                                       "missed": [{**span, "text": r["text"][span["start"]:span["end"]]}
                                                  for span, covered in zip(r["gold"], r["metrics"]["fully_covered"]) if not covered],
                                       "predictions": r["predictions"]}
                                      for r in own if r["status"] == "ok" and not r["metrics"]["leak_free"]]})
    (args.directory / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    def percent(value):
        return f"{value * 100:.1f}%" if value is not None else "—"
    lines = ["# DARI 로컬 개인정보 탐지 스크리닝 — 2026-11-17", "",
             "42개 가상 문장: 언어별 식별정보 6개(양성 5개·음성 1개), 민감속성 탐지 1개. 실제 신청인 데이터와 외부 LLM API를 사용하지 않았다.",
             "원어민 검수 전의 작은 고정 예제이며 모델 선정용 탐색 실험이다. 학습·조정·최종 검증을 분리한 평가가 아니므로 운영 성능으로 일반화할 수 없다.",
             "Mac CPU, FP32, 스레드 4개, 워밍업 후 각 문장을 2회 처리. 다운로드·모델 로딩은 문장 지연에서 제외. 각 모델은 별도 프로세스에서 실행했다.",
             "식별정보 6종: 이름·이메일·전화·주소·생년월일·여권번호. 종교·정당·의료정보는 별도 zero-shot 탐색으로 식별정보 점수에서 제외한다. 모델마다 같은 개념의 권장 라벨 이름을 사용했다.",
             "완전 가림률은 정답 구간의 공백 이외 모든 문자를 탐지한 비율이다. 한 글자라도 남으면 실패하며, 반복 등장한 이름도 각각 센다. 라벨 오분류는 가림률에 영향을 주지 않는다. 문자 정밀도는 과잉 마스킹을 보여 준다.",
             "Privacy Filter는 HF 구현과 BIOES 제약 Viterbi 어댑터를 사용했다. 배포 calibration의 6개 bias가 모두 0임을 확인했다. 공식 OPF 런타임 자체의 벤치마크는 아니다. 종교·정치·의료 분류는 기본 taxonomy에 없어 미지원으로 기록했다.", "",
             "| 모델 | 임계값 | 완전 가림 | 문자 정밀도 | 문자 재현율 | 누락 없는 양성 문장 | p50 / p90 ms |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for item in report:
        s = item["summary"]
        lines.append(f"| {item['model']} | {item['threshold'] if item['threshold'] is not None else '기본 Viterbi'} | {s['covered_entities']}/{s['entities']} ({percent(s['entity_recall'])}) | {percent(s['char_precision'])} | {percent(s['char_recall'])} | {s['positive_leak_free_samples']}/{s['positive_samples']} | {s['p50_ms']} / {s['p90_ms']} |")
    lines.extend(["", "## 언어별 완전 가림률", "", "| 모델 / 임계값 | ko | en | fr | ru | ar | fa |", "|---|---:|---:|---:|---:|---:|---:|"])
    for item in report:
        lines.append(f"| {item['model']} / {item['threshold']} | " + " | ".join(percent(s["entity_recall"]) for s in item["languages"].values()) + " |")
    lines.extend(["", "## 종류별 완전 가림", "", "| 모델 / 임계값 | 이름 | 이메일 | 전화 | 주소 | 생년월일 | 여권 |", "|---|---:|---:|---:|---:|---:|---:|"])
    for item in report:
        counts = [item["types"].get(label, {"covered": 0, "total": 0}) for label in ["person", "email", "phone", "address", "dob", "passport"]]
        lines.append(f"| {item['model']} / {item['threshold']} | " + " | ".join(f"{s['covered']}/{s['total']}" for s in counts) + " |")
    lines.extend(["", "## 민감속성 zero-shot 탐색", "", "| 모델 / 임계값 | 완전 가림 |", "|---|---:|"])
    for item in report:
        probe = item["sensitive_probe"]
        value = "기본 분류 미지원" if isinstance(probe, str) else f"{probe['covered_entities']}/{probe['entities']}"
        lines.append(f"| {item['model']} / {item['threshold']} | {value} |")
    lines.extend(["", "각 모델 JSON에는 모델 revision, 패키지 버전, 입력·정답 구간·예측 구간, 개별 지연, 오류가 기록되어 있다. summary.json의 misses에서 누락 사례를 확인할 수 있다.", ""])
    (args.directory / "REPORT.md").write_text("\n".join(lines))
    print("\n".join(lines[:18]))


if __name__ == "__main__":
    main()
