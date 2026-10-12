# DARI Graph Trace Viewer

Graph demo가 생성한 `*.trace.json`과 `*.report.json`을 브라우저에서 확인하는 로컬 도구다. 원문·번역문 graph, M0~M6의 실제 input/output, event alignment, candidate와 최종 finding을 한 화면에 표시한다.

## 실행

저장소 루트에서 trace를 생성하고 viewer를 실행한다.

```powershell
python experiments/verification/demos/graph_pipeline/run_demo.py `
  --output-dir experiments/verification/demos/graph_pipeline/outputs

python experiments/verification/tools/graph_viewer/serve.py
```

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:8765
```

기본적으로 `experiments/verification/demos/graph_pipeline/outputs`를 2초마다 다시 읽는다. 같은 파일을 실험 코드가 갱신하면 화면도 자동으로 바뀐다.

다른 trace 디렉터리를 보려면 다음 옵션을 사용한다.

```powershell
python experiments/verification/tools/graph_viewer/serve.py `
  --trace-dir "C:\path\to\trace-output" `
  --port 9000
```

## 화면에서 확인할 수 있는 것

- source/translation 입력과 finding evidence 강조
- Entity, Event, Value node와 edge
- candidate에 연결된 qualifier·node·edge 강조
- node 선택 시 semantic type, qualifier, evidence span
- M0~M6별 요약과 실제 JSON input/output
- 1:1·1:N event alignment
- 최종 report status와 finding

이 viewer는 trace를 읽기만 하며 DARI 서비스나 외부 모델을 호출하지 않는다.
