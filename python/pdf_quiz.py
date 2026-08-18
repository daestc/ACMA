"""표준입력으로 받은 PDF에서 텍스트를 추출하고 Claude 퀴즈 JSON을 출력한다.

이 스크립트는 Express가 자식 프로세스로 실행한다.
- stdin: PDF 바이너리
- stdout: 성공 시 JSON 하나
- stderr: 진단 로그
- exit code: Node 서비스가 사용자용 오류로 변환하는 상태 코드
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
from typing import Any

MAX_CHARS = 20_000
DEFAULT_MODEL = "claude-sonnet-4-6"
MIN_QUIZ_COUNT = 3
MAX_QUIZ_COUNT = 10

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

SYSTEM_PROMPT = """당신은 대학 학습 자료를 바탕으로 객관식 퀴즈를 만드는 출제자입니다.

규칙:
- 문제와 해설은 반드시 제공된 본문 내용에서만 작성한다. 본문에 없는 사실을 만들지 않는다.
- 단순 암기보다 개념 이해와 적용을 확인하는 문제를 우선한다.
- 각 문제는 서로 다른 핵심 내용을 다루고, 문맥 없이도 이해할 수 있게 작성한다.
- 선택지는 정확히 4개이며 오답도 본문과 관련된 그럴듯한 내용으로 만든다.
- "위의 모든 것", "정답 없음" 같은 선택지는 사용하지 않는다.
- 정답 위치가 특정 번호에 몰리지 않게 배분한다.
- explanation에는 본문에 근거한 정답 이유를 한두 문장으로 쓴다.
- source_page에는 정답 근거 앞에 표시된 [p.N]의 페이지 번호를 쓴다.
- 모든 문항과 해설은 한국어로 작성한다."""


class QuizPipelineError(Exception):
    """Node가 구분할 수 있는 종료 코드를 가진 파이프라인 오류."""

    def __init__(self, message: str, exit_code: int) -> None:
        super().__init__(message)
        self.exit_code = exit_code


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="stdin PDF로 AI 퀴즈 만들기")
    parser.add_argument("--count", type=int, default=5, help="문항 수 (3~10)")
    args = parser.parse_args()
    if not MIN_QUIZ_COUNT <= args.count <= MAX_QUIZ_COUNT:
        parser.error(f"count는 {MIN_QUIZ_COUNT}~{MAX_QUIZ_COUNT} 사이여야 합니다.")
    return args


def extract_text(pdf_bytes: bytes) -> tuple[str, int]:
    """PDF 바이너리에서 페이지 표식을 포함한 텍스트를 추출한다."""
    try:
        import pdfplumber
    except ImportError as exc:
        raise QuizPipelineError(
            "pdfplumber가 설치되지 않았습니다. pip install -r python/requirements.txt를 실행하세요.",
            5,
        ) from exc

    if not pdf_bytes.startswith(b"%PDF-"):
        raise QuizPipelineError("올바른 PDF 데이터가 아닙니다.", 2)

    chunks: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)
            for page_number, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                if text.strip():
                    chunks.append(f"[p.{page_number}]\n{text.strip()}")
    except Exception as exc:
        raise QuizPipelineError("PDF 파싱에 실패했습니다.", 2) from exc

    full_text = "\n\n".join(chunks)
    if not full_text.strip():
        raise QuizPipelineError(
            "텍스트를 추출하지 못했습니다. 스캔본 PDF라면 OCR이 필요합니다.",
            3,
        )
    return full_text, page_count


def quiz_schema() -> dict[str, Any]:
    """Claude 구조화 출력용 JSON Schema."""
    return {
        "type": "object",
        "properties": {
            "quiz": {
                "type": "array",
                "description": "요청받은 개수만큼 생성한 퀴즈 문항 배열",
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "options": {
                            "type": "array",
                            "description": "서로 다른 선택지 정확히 4개",
                            "items": {"type": "string"},
                        },
                        "answer_index": {"type": "integer", "enum": [0, 1, 2, 3]},
                        "explanation": {"type": "string"},
                        "source_page": {
                            "type": "integer",
                            "description": "본문의 [p.N]에서 확인한 1 이상의 페이지 번호",
                        },
                    },
                    "required": [
                        "question",
                        "options",
                        "answer_index",
                        "explanation",
                        "source_page",
                    ],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["quiz"],
        "additionalProperties": False,
    }


def validate_quiz(
    payload: Any,
    expected_count: int,
    allowed_pages: set[int] | None = None,
) -> list[dict[str, Any]]:
    """형식과 애플리케이션 규칙을 검사하고 문자열을 정리한다."""
    items = payload.get("quiz") if isinstance(payload, dict) else None
    if not isinstance(items, list) or len(items) != expected_count:
        raise QuizPipelineError("AI가 요청한 수만큼 문항을 만들지 못했습니다.", 6)

    valid: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise QuizPipelineError(f"{index}번 문항이 객체가 아닙니다.", 6)

        question = item.get("question", "")
        options = item.get("options")
        answer_index = item.get("answer_index")
        explanation = item.get("explanation", "")
        source_page = item.get("source_page")

        if not isinstance(question, str) or not question.strip():
            raise QuizPipelineError(f"{index}번 질문이 비어 있습니다.", 6)
        if not isinstance(options, list) or len(options) != 4:
            raise QuizPipelineError(f"{index}번 선택지가 4개가 아닙니다.", 6)

        cleaned_options = [option.strip() for option in options if isinstance(option, str)]
        if len(cleaned_options) != 4 or not all(cleaned_options) or len(set(cleaned_options)) != 4:
            raise QuizPipelineError(f"{index}번 선택지가 비어 있거나 중복됩니다.", 6)
        if isinstance(answer_index, bool) or not isinstance(answer_index, int) or not 0 <= answer_index < 4:
            raise QuizPipelineError(f"{index}번 정답 번호가 올바르지 않습니다.", 6)
        if not isinstance(explanation, str) or not explanation.strip():
            raise QuizPipelineError(f"{index}번 해설이 비어 있습니다.", 6)
        if isinstance(source_page, bool) or not isinstance(source_page, int) or source_page < 1:
            raise QuizPipelineError(f"{index}번 근거 페이지가 올바르지 않습니다.", 6)
        if allowed_pages is not None and source_page not in allowed_pages:
            raise QuizPipelineError(f"{index}번 근거 페이지가 제공된 본문 범위를 벗어났습니다.", 6)

        valid.append(
            {
                "question": question.strip(),
                "options": cleaned_options,
                "answer_index": answer_index,
                "explanation": explanation.strip(),
                "source_page": source_page,
            }
        )
    return valid


def generate_quiz(text: str, count: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """추출 텍스트를 Claude에 전달해 구조화된 퀴즈를 생성한다."""
    try:
        from anthropic import Anthropic
    except ImportError as exc:
        raise QuizPipelineError(
            "anthropic SDK가 설치되지 않았습니다. pip install -r python/requirements.txt를 실행하세요.",
            5,
        ) from exc

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise QuizPipelineError("ANTHROPIC_API_KEY가 설정되지 않았습니다.", 4)

    model = os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    original_chars = len(text)
    selected_text = text[:MAX_CHARS]
    allowed_pages = {int(page) for page in re.findall(r"\[p\.(\d+)\]", selected_text)}

    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=model,
            max_tokens=min(8_000, 1_000 + count * 550),
            temperature=0.7,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"다음 본문으로 4지선다 문제 {count}개를 만들어 주세요. "
                        "본문의 페이지 표식을 근거 페이지로 사용하세요.\n\n"
                        f"<본문>\n{selected_text}\n</본문>"
                    ),
                }
            ],
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": quiz_schema(),
                }
            },
        )
    except Exception as exc:
        raise QuizPipelineError("Claude API 호출에 실패했습니다.", 5) from exc

    if getattr(response, "stop_reason", None) in {"max_tokens", "refusal"}:
        raise QuizPipelineError("Claude가 완전한 퀴즈 응답을 반환하지 못했습니다.", 6)

    raw = next(
        (block.text for block in response.content if getattr(block, "type", None) == "text"),
        "",
    )
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise QuizPipelineError("Claude 응답의 JSON 파싱에 실패했습니다.", 6) from exc

    quiz = validate_quiz(payload, count, allowed_pages)
    meta = {
        "model": model,
        "extracted_chars": original_chars,
        "used_chars": len(selected_text),
        "truncated": original_chars > MAX_CHARS,
    }
    return quiz, meta


def main() -> int:
    args = parse_args()
    try:
        pdf_bytes = sys.stdin.buffer.read()
        text, page_count = extract_text(pdf_bytes)
        quiz, meta = generate_quiz(text, args.count)
        meta["page_count"] = page_count
        json.dump({"quiz": quiz, "meta": meta}, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    except QuizPipelineError as exc:
        print(str(exc), file=sys.stderr)
        return exc.exit_code
    except Exception as exc:  # 예상하지 못한 오류도 stdout JSON을 오염시키지 않는다.
        print(f"예상하지 못한 Python 오류: {exc}", file=sys.stderr)
        return 5


if __name__ == "__main__":
    raise SystemExit(main())
