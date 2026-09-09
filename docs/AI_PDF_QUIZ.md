# Python 기반 AI PDF 퀴즈 기능

## 아키텍처

웹 애플리케이션과 AI 파이프라인의 책임을 분리한다.

```text
브라우저
  → Express 업로드 API
  → Python 자식 프로세스
  → pdfplumber 텍스트 추출
  → Anthropic Python SDK
  → 퀴즈 JSON
  → Express 검증·사용량 반영
  → 브라우저 풀이·채점
```

- Node.js/Express: 로그인, 업로드, 사용량 제한, Python 실행, API 응답
- Python: PDF 텍스트 추출, 프롬프트 구성, Claude 호출, 결과 검증
- 브라우저: 파일 사전 검사, 진행 상태, 문제 풀이와 채점

## Python 환경 준비

프로젝트 루트에서 가상환경을 만든다.

### Windows PowerShell

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r python/requirements.txt
```

`.env`에는 다음 값을 추가한다.

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-6
PYTHON_EXECUTABLE=C:\myProgram\git\webProject_git\ACMA\.venv\Scripts\python.exe
```

프로젝트 루트의 `.venv`는 Express가 자동으로 탐지한다. 다른 위치의 가상환경이나 시스템 Python을 사용하려는 경우에만 `PYTHON_EXECUTABLE`을 지정하면 된다. 실제 API 키와 개인별 절대 경로는 저장소에 커밋하지 않는다.

## 요청 처리 흐름

1. 사용자가 `/study`에서 PDF와 3·5·7·10개 중 문항 수를 선택한다.
2. 브라우저가 `.pdf`, `application/pdf`, 20MB 제한을 검사한다.
3. `multipart/form-data`로 `POST /study/quiz/generate`를 요청한다.
4. Express가 로그인, 15분당 호출 제한, 무료 플랜 하루 10회 제한을 확인한다.
5. Multer가 PDF를 디스크가 아닌 메모리 버퍼로 받는다.
6. Node가 파일 첫 5바이트의 `%PDF-` 시그니처를 확인한다.
7. Node가 `python/pdf_quiz.py --count N`을 자식 프로세스로 실행한다.
8. PDF 바이너리를 Python 프로세스의 표준입력으로 전달한다. 임시 파일은 만들지 않는다.
9. Python이 `io.BytesIO`와 `pdfplumber`로 각 페이지의 텍스트를 추출하고 `[p.N]` 표식을 붙인다.
10. 추출 텍스트가 20,000자를 넘으면 앞 20,000자를 Claude에 사용하고 잘림 여부를 메타데이터로 반환한다.
11. Python Anthropic SDK가 시스템 프롬프트와 본문을 Claude Messages API에 전달한다.
12. JSON Schema 구조화 출력으로 질문, 선택지, 정답 번호, 해설, 근거 페이지 자료형을 고정한다.
13. Python이 문항 수, 선택지 개수·중복, 정답 범위, 해설과 페이지를 검증한다.
14. 성공 JSON 하나만 표준출력에 쓰고 로그와 오류는 표준오류에 쓴다.
15. Node가 JSON을 파싱한 후 같은 규칙을 다시 검사한다.
16. 성공한 요청만 MongoDB와 세션의 일일 사용량을 증가시킨다.
17. 브라우저가 정답 대응 관계를 유지하면서 선택지를 섞어 한 문제씩 표시한다.

## Node와 Python 통신 원리

`services/studyQuizService.js`는 Node의 `child_process.spawn()`으로 Python을 실행한다.

```text
Node child.stdin  ── PDF bytes ──>  Python sys.stdin.buffer
Node child.stdout <── JSON only ──  Python sys.stdout
Node child.stderr <── diagnostics ─  Python sys.stderr
```

표준입력을 쓰는 이유:

- 사용자 PDF를 임시 디렉터리에 남기지 않는다.
- 임시 파일명 충돌과 삭제 실패를 피한다.
- 요청 단위로 데이터 수명과 Python 프로세스 수명을 일치시킨다.

Node는 Python 프로세스를 최대 180초 기다린다. 출력 JSON은 5MB로 제한하며, 실행 파일 누락·시간 초과·비정상 종료·잘못된 JSON을 각각 안전한 API 오류로 바꾼다.

Python 종료 코드는 다음과 같다.

| 코드 | 의미 |
|---|---|
| 0 | 성공 |
| 2 | PDF 파싱 실패 |
| 3 | 추출 가능한 텍스트 없음 |
| 4 | API 키 미설정 |
| 5 | SDK 누락 또는 Claude 호출 실패 |
| 6 | AI 응답 검증 실패 |

## Python AI 파이프라인

`python/pdf_quiz.py`의 주요 단계는 다음과 같다.

### 1. PDF 텍스트 추출

```python
with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    for page_number, page in enumerate(pdf.pages, start=1):
        text = page.extract_text() or ""
```

페이지 표식을 함께 넣기 때문에 AI가 `source_page`를 작성할 수 있다. `pdfplumber`는 기계 생성 PDF의 텍스트 추출에 적합하다. 이미지로만 구성된 스캔본은 텍스트가 없으므로 별도 OCR 단계가 필요하다.

### 2. 길이 제한

```python
selected_text = text[:20_000]
```

참고 코드와 같은 제한을 사용한다. 원본 글자 수, 실제 사용 글자 수, 잘림 여부는 응답 메타데이터에 포함된다.

### 3. Claude 호출

```python
client = Anthropic(api_key=api_key)
response = client.messages.create(
    model=model,
    system=SYSTEM_PROMPT,
    messages=[{"role": "user", "content": prompt}],
    output_config={"format": {"type": "json_schema", "schema": quiz_schema()}},
)
```

프롬프트는 본문 밖의 사실 사용 금지, 개념 이해형 문제, 4개 선택지, 정답 위치 분산, 해설과 근거 페이지를 요구한다.

### 4. 이중 검증

구조화 출력이 JSON 문법과 필드 자료형을 안정화해도 비즈니스 규칙은 별도로 검사한다.

- 요청 문항 수와 실제 문항 수가 같은가
- 질문과 해설이 비어 있지 않은가
- 선택지가 정확히 4개이고 모두 다른가
- `answer_index`가 0~3 정수인가
- `source_page`가 1 이상의 정수인가

검증은 Python과 Node에서 각각 수행한다. Python 코드가 변경되거나 손상된 결과가 전달돼도 Express가 마지막 방어선이 된다.

## API 형식

요청:

```text
POST /study/quiz/generate
Content-Type: multipart/form-data

pdf: PDF 파일
count: 3 | 5 | 7 | 10
```

성공 응답:

```json
{
  "ok": true,
  "quiz": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer_index": 0,
      "explanation": "본문에 근거한 해설",
      "source_page": 3
    }
  ],
  "meta": {
    "model": "claude-sonnet-4-6",
    "extraction": {
      "pageCount": 12,
      "extractedChars": 25400,
      "usedChars": 20000,
      "truncated": true
    }
  }
}
```

## 테스트

```powershell
npm test
```

이 명령은 Node 서비스 테스트와 Python 파이프라인 테스트를 모두 실행한다.

Python 스크립트의 문법만 확인하려면 다음을 사용할 수 있다.

```powershell
python -c "import ast, pathlib; ast.parse(pathlib.Path('python/pdf_quiz.py').read_text(encoding='utf-8'))"
```

## 제한 및 확장 방향

- 스캔본 PDF는 OCR이 필요하다. 향후 Tesseract 또는 클라우드 OCR을 추출 단계 앞에 추가할 수 있다.
- 현재 20,000자를 초과하면 뒷부분을 사용하지 않는다. 긴 자료를 고르게 다루려면 페이지별 청크 생성 후 문항을 병합하는 방식으로 확장할 수 있다.
- 요청마다 Python 프로세스를 하나 실행한다. 트래픽이 많아지면 Python FastAPI 서비스를 상시 실행하고 Express가 내부 HTTP로 호출하는 구조가 효율적이다.
- 퀴즈는 현재 브라우저 메모리에만 있으므로 새로고침하면 사라진다. 영구 저장이 필요하면 QuizSet 모델과 사용자 소유권 검사를 추가한다.
