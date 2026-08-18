const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MIN_QUIZ_COUNT = 3;
const MAX_QUIZ_COUNT = 10;
const PYTHON_TIMEOUT_MS = 180000;
const MAX_PYTHON_OUTPUT_BYTES = 5 * 1024 * 1024;
const PYTHON_SCRIPT = path.join(__dirname, '../python/pdf_quiz.py');

function createServiceError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizeCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < MIN_QUIZ_COUNT || count > MAX_QUIZ_COUNT) {
    throw createServiceError(
      'INVALID_COUNT',
      `문항 수는 ${MIN_QUIZ_COUNT}개에서 ${MAX_QUIZ_COUNT}개 사이여야 합니다.`,
      400,
    );
  }
  return count;
}

function assertPdfBuffer(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 5) {
    throw createServiceError('INVALID_PDF', 'PDF 파일 내용이 비어 있습니다.', 400);
  }
  if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw createServiceError('INVALID_PDF', '올바른 PDF 파일이 아닙니다.', 400);
  }
}

function pythonExecutable() {
  const configured = (process.env.PYTHON_EXECUTABLE || '').trim();
  if (configured) return configured;

  const localPython = process.platform === 'win32'
    ? path.join(__dirname, '../.venv/Scripts/python.exe')
    : path.join(__dirname, '../.venv/bin/python');
  return fs.existsSync(localPython) ? localPython : 'python';
}

function buildPythonArgs(count) {
  return [PYTHON_SCRIPT, '--count', String(count)];
}

function validateQuiz(payload, expectedCount, maxPage = null) {
  const items = payload?.quiz;
  if (!Array.isArray(items) || items.length !== expectedCount) {
    throw createServiceError('INVALID_AI_RESPONSE', 'AI가 요청한 수만큼 문항을 만들지 못했습니다.');
  }

  return items.map((item, index) => {
    const question = typeof item?.question === 'string' ? item.question.trim() : '';
    const options = Array.isArray(item?.options)
      ? item.options.map((option) => (typeof option === 'string' ? option.trim() : ''))
      : [];
    const explanation = typeof item?.explanation === 'string' ? item.explanation.trim() : '';
    const sourcePage = Number(item?.source_page);

    const isValid = question
      && options.length === 4
      && options.every(Boolean)
      && new Set(options).size === 4
      && Number.isInteger(item?.answer_index)
      && item.answer_index >= 0
      && item.answer_index < 4
      && explanation
      && Number.isInteger(sourcePage)
      && sourcePage > 0
      && (!Number.isInteger(maxPage) || sourcePage <= maxPage);

    if (!isValid) {
      throw createServiceError(
        'INVALID_AI_RESPONSE',
        `AI가 만든 ${index + 1}번 문항의 형식이 올바르지 않습니다.`,
      );
    }

    return {
      question,
      options,
      answer_index: item.answer_index,
      explanation,
      source_page: sourcePage,
    };
  });
}

function pythonExitError(exitCode) {
  const errors = {
    2: ['INVALID_PDF', 'PDF 파일을 읽지 못했습니다.', 400],
    3: ['PDF_TEXT_NOT_FOUND', 'PDF에서 텍스트를 추출하지 못했습니다. 스캔본이라면 OCR이 필요합니다.', 400],
    4: ['AI_NOT_CONFIGURED', 'Python 환경에 ANTHROPIC_API_KEY가 설정되지 않았습니다.', 503],
    5: ['AI_UNAVAILABLE', 'Python AI 퀴즈 생성 중 오류가 발생했습니다.', 502],
    6: ['INVALID_AI_RESPONSE', 'AI 응답을 퀴즈 형식으로 해석하지 못했습니다.', 502],
  };
  const [code, message, status] = errors[exitCode]
    || ['PYTHON_PROCESS_FAILED', 'Python 퀴즈 생성 프로세스가 비정상 종료되었습니다.', 500];
  return createServiceError(code, message, status);
}

function runPythonQuiz(pdfBuffer, count) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable(), buildPythonArgs(count), {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(reject, createServiceError(
        'PYTHON_TIMEOUT',
        'Python AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
        504,
      ));
    }, PYTHON_TIMEOUT_MS);

    child.on('error', (error) => {
      const mapped = error.code === 'ENOENT'
        ? createServiceError(
          'PYTHON_NOT_FOUND',
          'Python 실행 파일을 찾지 못했습니다. PYTHON_EXECUTABLE 설정을 확인해 주세요.',
          503,
        )
        : createServiceError('PYTHON_PROCESS_FAILED', 'Python 프로세스를 시작하지 못했습니다.', 500);
      finish(reject, mapped);
    });

    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_PYTHON_OUTPUT_BYTES) {
        child.kill();
        finish(reject, createServiceError('PYTHON_OUTPUT_TOO_LARGE', 'Python 결과가 허용 크기를 초과했습니다.'));
        return;
      }
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk) => {
      // 로그 폭주를 막되 서버 로그에서 원인 확인이 가능하도록 일부만 보관한다.
      if (Buffer.concat(stderrChunks).length < 8192) stderrChunks.push(chunk);
    });

    child.on('close', (exitCode) => {
      if (settled) return;
      if (exitCode !== 0) {
        const diagnostic = Buffer.concat(stderrChunks).toString('utf8').trim();
        const mapped = pythonExitError(exitCode);
        mapped.diagnostic = diagnostic.slice(0, 2000);
        finish(reject, mapped);
        return;
      }

      try {
        const parsed = JSON.parse(Buffer.concat(stdoutChunks).toString('utf8'));
        finish(resolve, parsed);
      } catch (_error) {
        finish(reject, createServiceError(
          'INVALID_PYTHON_RESPONSE',
          'Python 결과를 JSON으로 해석하지 못했습니다.',
          502,
        ));
      }
    });

    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') {
        finish(reject, createServiceError('PYTHON_INPUT_FAILED', 'PDF를 Python 프로세스에 전달하지 못했습니다.'));
      }
    });
    child.stdin.end(pdfBuffer);
  });
}

async function generateQuizFromPdf(pdfBuffer, requestedCount) {
  const count = normalizeCount(requestedCount);
  assertPdfBuffer(pdfBuffer);

  const result = await runPythonQuiz(pdfBuffer, count);
  return {
    quiz: validateQuiz(result, count, result.meta?.page_count),
    model: result.meta?.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    extraction: result.meta || null,
  };
}

module.exports = {
  DEFAULT_MODEL,
  MIN_QUIZ_COUNT,
  MAX_QUIZ_COUNT,
  PYTHON_SCRIPT,
  normalizeCount,
  assertPdfBuffer,
  buildPythonArgs,
  validateQuiz,
  generateQuizFromPdf,
};
