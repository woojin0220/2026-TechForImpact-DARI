"""Report the expanded comparison; unknown/error cases are never silently dropped."""
import argparse
from collections import Counter
import json
from pathlib import Path
import statistics


def aggregate(rows):
    evaluated = [r for r in rows if r["status"] != "unsupported_taxonomy"]
    totals = {key: sum(r["metrics"][key] for r in evaluated) for key in
              ["tp", "fp", "fn", "entities", "covered_entities", "core_covered_entities", "protected_hits", "protected_count"]}
    times = sorted(v for r in evaluated for v in r.get("latency_ms", []))
    date_indices = {"dob_event": [0], "negative": [1], "date_only": [0,1]}
    date_count = sum(len(date_indices.get(r["group"], [])) for r in evaluated)
    date_hits = sum(sum(r["metrics"]["protected_hit"][i] for i in date_indices.get(r["group"], [])) for r in evaluated)
    ratio = lambda a,b: a/b if b else None
    return {**totals, "cases": len(evaluated), "errors": sum(r["status"] == "error" for r in evaluated),
            "unsupported": len(rows) - len(evaluated), "protected_date_count": date_count, "protected_date_hits": date_hits,
            "full_span_recall": ratio(totals["covered_entities"], totals["entities"]),
            "core_entity_recall": ratio(totals["core_covered_entities"], totals["entities"]),
            "char_precision": ratio(totals["tp"], totals["tp"] + totals["fp"]),
            "char_recall": ratio(totals["tp"], totals["tp"] + totals["fn"]),
            "positive_cases": sum(bool(r["gold"]) for r in evaluated),
            "positive_leak_free": sum(bool(r["gold"]) and r["metrics"]["leak_free"] for r in evaluated),
            "p50_ms": statistics.median(times) if times else None,
            "p90_ms": times[min(len(times)-1, int(len(times)*.9))] if times else None,
            "non_deterministic": sum(not r.get("repeat_consistent", True) for r in evaluated)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("directory", type=Path)
    args = p.parse_args()
    results = []
    for name in ["gliner", "liquid_raw", "liquid_hybrid", "nym"]:
        path = args.directory / (name + ".json")
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        rows = data["rows"]
        result = {"name": name, "model": data["model"], "revision": data["revision"], "status": data.get("status"),
                  "fixture_sha256": data["fixture_sha256"], "rows": len(rows),
                  "parameters": data.get("parameters"), "load_seconds": data.get("load_seconds"),
                  "latency_kind": data.get("latency_kind", "measured end-to-end per case; download/load excluded"),
                  "short_identifiers": aggregate([r for r in rows if r["track"] == "identifiers"]),
                  "expanded_only": aggregate([r for r in rows if r["track"] == "identifiers" and r["group"] != "original"]),
                  "original_only": aggregate([r for r in rows if r["track"] == "identifiers" and r["group"] == "original"]),
                  "sensitive": aggregate([r for r in rows if r["track"] == "sensitive"]),
                  "long_whole": aggregate([r for r in rows if r["group"] == "long" and r["mode"] == "whole"]),
                  "long_chunked": aggregate([r for r in rows if r["group"] == "long" and r["mode"] == "chunked"]),
                  "boundary_whole": aggregate([r for r in rows if r["group"] == "boundary" and r["mode"] == "whole"]),
                  "boundary_chunked": aggregate([r for r in rows if r["group"] == "boundary" and r["mode"] == "chunked"]),
                  "languages": {lang: aggregate([r for r in rows if r["track"] == "identifiers" and r["language"] == lang]) for lang in ["ko","en","fr","ru","ar","fa"]},
                  "groups": {group: aggregate([r for r in rows if r["group"] == group and r["mode"] == "whole"]) for group in dict.fromkeys(r["group"] for r in rows)},
                  "misses": [{"id": r["id"], "mode": r["mode"], "track": r["track"],
                              "missed": [{**g, "text": r["text"][g["start"]:g["end"]]} for g, full in zip(r["gold"],r["metrics"]["fully_covered"]) if not full],
                              "protected_damaged": [{**g,"text":r["text"][g["start"]:g["end"]]} for g, hit in zip(r["protected"],r["metrics"]["protected_hit"]) if hit]}
                             for r in rows if r["status"] != "unsupported_taxonomy" and (not r["metrics"]["leak_free"] or r["metrics"]["protected_hits"])]}
        results.append(result)
    (args.directory / "comparison-summary.json").write_text(json.dumps(results, ensure_ascii=False, indent=2)+"\n")
    pct = lambda value: f"{value*100:.1f}%" if value is not None else "—"
    count = lambda s: f"{s['covered_entities']}/{s['entities']} ({pct(s['full_span_recall'])})" if s['entities'] else "—"
    ms = lambda value: f"{value:.0f}" if value is not None else "—"
    fixtures=json.loads((args.directory/'expanded-fixtures.json').read_text())
    lines = ["# DARI: GLiNER / LiquidAI / nym 확대 비교", "",
             "## 방법과 범위", "",
             f"고정된 가상 입력 {len(fixtures)}개, 한국어·영어·프랑스어·러시아어·아랍어·페르시아어 각 15개. 이전 42개는 변경하지 않았으며 실행 전 평가셋을 고정했다.",
             "정답 검토 중 한국어 새 예제 1개에서 반복된 성/이름 두 구간의 누락을 수정했다. 추론 텍스트는 모든 글자가 동일하며, 첫 Liquid raw 출력은 재추론 없이 수정된 정답으로 재채점했다. annotation-corrections.json과 expanded-fixtures-initial.json에 최초 정답과 수정 내역을 보존했다.",
             "식별정보 단문 66개, 민감속성 12개, 장문/분할경계 12개. 장문은 중립 문장을 반복한 길이 스트레스 입력이며 자연스러운 진술문 전체를 대표하지 않는다. 오탈자 예제도 소수의 인위적인 띄어쓰기 오류이다.",
             "CPU FP32, 스레드 4개, 모델별 별도 프로세스에서 순차 실행. 워밍업 후 각 입력 2회. 단문과 장문의 지연은 섞지 않았다. 실제 신청인 자료, 외부 LLM, API 키는 사용하지 않았다. 모델 파일을 받은 뒤 HF_HUB_OFFLINE=1로 실행했다.",
             "GLiNER는 임계값 0.3의 native span decoder. nym/Liquid는 토큰 argmax 후 BIO/BIOES 묶기. Liquid의 검토한 고정 revision 커스텀 모델 코드만 허용했다. 모델별 버전과 패키지는 원시 JSON에 기록했다.",
             "Liquid hybrid는 동일한 raw 예측에 제작자 hybrid_spans(정규식·검증·문맥 cue)를 적용한 별도 결과다. 장문은 분할 예측을 합친 뒤 전체 텍스트에 후처리한다. 지연은 실제 raw 추론 시간 + 별도 측정 후처리 시간이며, 두 번째 end-to-end 실행 시간이 아니다.",
             "공정한 식별정보 비교를 위해 이름·이메일·전화·주소·생년월일·여권에 해당하는 라벨만 마스킹 정책에 넣었다. nym 주소는 도시/거리/건물 등 구성 라벨을 합산하며, 일반 DATE는 생년월일과 구분해 제외한다. 원래 모든 출력 라벨은 raw_predictions에 남긴다.",
             "LiquidAI와 nym의 명시적 지원 언어에 페르시아어는 포함되어 있지 않다. 페르시아어도 DARI의 후보 언어이므로 제외하지 않고 일반화 시험으로 포함했다.",
             "민감속성은 종교·정치단체·질병 3종을 별도 평가했다. GLiNER는 추가 라벨 zero-shot, Liquid는 해당 학습 라벨, nym은 기본 taxonomy에 없어 미지원이다. 미지원에 가짜 0점 또는 100점을 부여하지 않았다.",
             "완전 가림은 정답 구간의 공백 이외 모든 문자가 예측에 포함되어야 한다. 핵심 문자 가림은 문자·숫자만 비교하며, 주소 구두점처럼 남아도 식별정보가 아닌 경계 차이를 구분한다. 러시아어 года 같은 문법 단어는 엄격 지표에서 여전히 누락으로 센다. 두 지표 모두 의미적 익명성을 증명하지 않는다.",
             "보존 구간은 사건 날짜·부정 표현 등 명시적으로 KEEP 표시한 42개 구간이다. 한 글자라도 마스킹하면 손상으로 센다. 이는 DARI의 테스트 정책이며 모든 상황에서 사건 날짜가 비민감하다는 주장이 아니다.",
             "KEEP 손상에는 부정 문장 속 대명사 I/je 하나만 가린 사례도 포함한다. 숫자 14/42를 의미가 파괴된 문장 14개라고 해석하지 않도록 사건 날짜 24개 구간의 오마스킹을 별도로 표시했다. nym은 한국어 구금의 구/금을 이름으로, 페르시아어 단어의 일부를 이름으로 오탐한 사례가 있다.",
             "장문은 기본 통째 처리와 동일한 220문자/80문자 겹침 분할을 따로 평가한다. 창별 결과는 문자 위치로 합치고 점수는 구간 합집합으로 계산했다. 분할 크기 최적화나 실기기 시험은 하지 않았다.",
             "제작자 공개 벤치마크와 다른 소규모 탐색 실험이다. 원어민 검수·실제 도메인 별도 검증셋·독립 공개 벤치마크가 없어 운영 성능이나 보편적인 모델 우열을 확정할 수 없다.", "",
             "## 단문 식별정보", "", "| 설정 | 완전 가림 | 핵심 문자 가림 | 문자 정밀도 | 문자 재현율 | 누락 없는 양성 입력 | p50 / p90 ms | KEEP 손상 |", "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in results:
        s=r["short_identifiers"]
        lines.append(f"| {r['name']} | {count(s)} | {pct(s['core_entity_recall'])} | {pct(s['char_precision'])} | {pct(s['char_recall'])} | {s['positive_leak_free']}/{s['positive_cases']} | {ms(s['p50_ms'])} / {ms(s['p90_ms'])} | {s['protected_hits']}/{s['protected_count']} |")
    lines += ["", "### 사건 날짜 보존", "", "| 설정 | 사건 날짜 오마스킹 |", "|---|---:|"]
    for r in results:
        s=r['short_identifiers']
        lines.append(f"| {r['name']} | {s['protected_date_hits']}/{s['protected_date_count']} |")
    lines += ["", "## 이전 예제와 새 예제 분리", "", "| 설정 | 이전 예제 완전 가림 | 새 예제 완전 가림 |", "|---|---:|---:|"]
    for r in results: lines.append(f"| {r['name']} | {count(r['original_only'])} | {count(r['expanded_only'])} |")
    lines += ["", "## 언어별 단문 완전 가림률", "", "| 설정 | ko | en | fr | ru | ar | fa |", "|---|---:|---:|---:|---:|---:|---:|"]
    for r in results: lines.append(f"| {r['name']} | "+" | ".join(pct(s["full_span_recall"]) for s in r['languages'].values())+" |")
    lines += ["", "## 민감속성", "", "| 설정 | 완전 가림 | 핵심 문자 가림 | 문자 재현율 |", "|---|---:|---:|---:|"]
    for r in results:
        s=r["sensitive"]
        lines.append(f"| {r['name']} | {count(s) if s['cases'] else '기본 분류 미지원'} | {pct(s['core_entity_recall'])} | {pct(s['char_recall'])} |")
    lines += ["", "## 긴 진술 길이 스트레스", "", "| 설정 | 통째 완전 가림 | 분할 완전 가림 | 통째 p50 ms | 분할 p50 ms |", "|---|---:|---:|---:|---:|"]
    for r in results:
        a,b=r['long_whole'],r['long_chunked']
        lines.append(f"| {r['name']} | {count(a)} | {count(b)} | {ms(a['p50_ms'])} | {ms(b['p50_ms'])} |")
    lines += ["", "## 짧은 분할경계 입력", "", "| 설정 | 통째 완전 가림 | 분할 완전 가림 |", "|---|---:|---:|"]
    for r in results: lines.append(f"| {r['name']} | {count(r['boundary_whole'])} | {count(r['boundary_chunked'])} |")
    lines += ["", "## 실행 상태", "", "| 설정 | 상태 | 행 수 | 오류 | 반복 결과 불일치 |", "|---|---|---:|---:|---:|"]
    for r in results:
        data=json.loads((args.directory/(r['name']+'.json')).read_text())
        lines.append(f"| {r['name']} | {r['status']} | {r['rows']} | {sum(x['status']=='error' for x in data['rows'])} | {sum(not x.get('repeat_consistent',True) for x in data['rows'])} |")
    probe_path = args.directory/'liquid-version-comparison.json'
    if probe_path.exists():
        probe = json.loads(probe_path.read_text())
        lines += ["", "## LiquidAI 버전 호환성 확인", "",
                  f"체크포인트에 명시된 Transformers 5.11.0을 별도 임시 경로에 설치하고, 기존 5.22.2와 6개 언어의 일반/민감 예제 {len(probe['cases'])}개를 비교했다. 모든 입력 토큰·argmax 태그·탐지 구간이 같았고 logits 최대 절대 차이는 {max(r['max_abs_logits_diff'] for r in probe['cases'])}이었다. 이 12개 입력에서는 버전 차이가 낮은 점수를 설명하지 못했다. 전체 장문에 대한 버전 동일성까지 검증한 것은 아니다. 상세 출력은 liquid-version-comparison.json에 있다."]
    lines += ["", "## 이번 실험에서의 판단", "",
              "단문 개인정보 누락을 줄이는 쪽은 GLiNER가 우세했다(123/127). 다만 사건 날짜 오마스킹(7/24)과 대명사/일반 구절 오탐이 있어 무조건 치환하는 용도로는 부적절하다.",
              "nym은 단문 완전 가림이 116/127로 낮지만 문자 정밀도 97.9%, 사건 날짜 오마스킹 0/24였고, 길이 스트레스 입력은 통째 처리로 18/18을 찾았다. 장문 식별정보 탐지의 유망한 대안이며 한국어 구금 단어를 이름으로 오탐한 사례 등은 별도 보완해야 한다. 종교·정치·질병 분류는 기본 지원하지 않는다.",
              "LiquidAI는 이번 구현/예제에서는 권장 후처리를 적용해도 단문 84/127, 민감속성 완전 가림 0/36이었다(민감속성 문자 재현율은 13.3%로 일부 구간은 탐지). 명시적인 라벨 목록만으로 DARI의 민감정보 처리에 더 적합하다고 판단할 수 없었다.",
              "DARI에 바로 모델 하나를 자동 치환기로 연결하는 단계는 아니다. 긴 입력의 처리 정책, 양식에서 이미 아는 식별정보 치환, 사건 날짜와 생년월일 구분, 민감 진술의 외부 전송 범위를 함께 설계하고 독립 검증셋에서 다시 측정해야 한다. 이번에는 앱의 추론/전송 동작을 바꾸지 않았다.",
              "", "comparison-summary.json에 언어별·사례군별 집계와 누락/KEEP 손상 목록을 저장했다. 각 모델 JSON의 gold·predictions·raw_predictions로 원문 위치를 직접 확인할 수 있다.", ""]
    (args.directory/'REPORT.md').write_text('\n'.join(lines))
    print('\n'.join(lines[18:28]))


if __name__ == "__main__":
    main()
