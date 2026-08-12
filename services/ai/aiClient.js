const axios = require('axios');
const logger = require('../../config/logger');

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const RETRY_DELAYS_MS = [1000, 3000];

class AiClientError extends Error {
  constructor(message, { code, statusCode = null, retryable = false } = {}) {
    super(message);
    this.name = 'AiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 원시 OpenAI Chat Completions 호출. 429/5xx/타임아웃은 지수 백오프로 최대 2회 재시도.
// 400/401/403은 재시도 무의미하므로 즉시 실패.
async function callGPT({ system, user, maxTokens = 4000, responseFormat = null }) {
  const started = Date.now();
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const { data } = await axios.post(ENDPOINT, {
        model: process.env.OPENAI_MODEL,
        max_completion_tokens: Number(process.env.AI_MAX_TOKENS ?? maxTokens),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.AI_TIMEOUT_MS ?? 60000),
      });

      return {
        text: data.choices[0].message.content,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
        model: data.model,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const isTimeout = error.code === 'ECONNABORTED';
      const retryable = isTimeout || status === 429 || (status >= 500 && status < 600);

      if (!retryable || attempt === RETRY_DELAYS_MS.length) {
        const apiMessage = error.response?.data?.error?.message;
        logger.error(`[ai] OpenAI 호출 실패 status=${status ?? 'n/a'} model=${process.env.OPENAI_MODEL} reason=${apiMessage || error.message}`);
        throw new AiClientError(
          `OpenAI API 호출 실패${status ? ` (status ${status})` : ''}`,
          { code: 'OPENAI_REQUEST_FAILED', statusCode: status ?? null, retryable: false },
        );
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  // 도달하지 않지만 방어적으로 마지막 에러를 던짐
  throw lastError;
}

function stripCodeFence(raw) {
  return String(raw || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

// JSON 응답 전용. 파싱 실패 시 1회만 재시도.
// schema를 주면 OpenAI Structured Outputs(json_schema, strict:true)를 써서 최상위
// 키 이름/중첩 구조까지 강제한다 — json_object 모드는 "유효한 JSON"만 보장할 뿐
// 모델이 goal/items를 엉뚱한 이름으로 감싸 보내는 걸 막지 못한다(실제로 발생했던
// 실패 유형). schema가 없으면 기존 json_object 모드로 폴백한다.
async function generateJSON({ system, user, maxTokens = 4000, schema = null }) {
  let retryCount = 0;
  let currentUser = user;
  const responseFormat = schema
    ? { type: 'json_schema', json_schema: schema }
    : { type: 'json_object' };

  for (let attempt = 0; attempt <= 1; attempt += 1) {
    const result = await callGPT({
      system,
      user: currentUser,
      maxTokens,
      responseFormat,
    });

    const cleaned = stripCodeFence(result.text);

    try {
      const data = JSON.parse(cleaned);

      logger.info(`[ai] generateJSON success model=${result.model} in=${result.usage.input_tokens} out=${result.usage.output_tokens} latencyMs=${result.latencyMs} retryCount=${retryCount}`);

      return {
        data,
        meta: {
          model: result.model,
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          latencyMs: result.latencyMs,
          retryCount,
        },
      };
    } catch (parseError) {
      retryCount += 1;
      logger.warn(`[ai] generateJSON parse failure attempt=${attempt} bytes=${Buffer.byteLength(cleaned, 'utf8')}`);

      currentUser = `${user}\n\n이전 응답이 유효한 JSON이 아니었습니다. 설명, 인사말, 코드펜스 없이\nJSON 객체 하나만 출력하세요.`;
    }
  }

  logger.error('[ai] generateJSON failed after retry: invalid JSON from model');
  throw new AiClientError('LLM 응답을 JSON으로 해석하지 못했습니다.', {
    code: 'INVALID_JSON_RESPONSE',
    retryable: false,
  });
}

module.exports = { callGPT, generateJSON, AiClientError };
