async function parseJsonSafe(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function apiGet(path) {
  const res = await fetch(path)
  const body = await parseJsonSafe(res)
  if (!res.ok) {
    const err = new Error(body?.message || `요청에 실패했습니다 (${res.status})`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const responseBody = await parseJsonSafe(res)
  if (!res.ok) {
    const err = new Error(responseBody?.message || `요청에 실패했습니다 (${res.status})`)
    err.status = res.status
    err.body = responseBody
    throw err
  }
  return responseBody
}

export async function apiPostForm(path, formData) {
  const res = await fetch(path, {
    method: 'POST',
    body: formData,
  })
  const body = await parseJsonSafe(res)
  if (!res.ok) {
    const err = new Error(body?.message || `요청에 실패했습니다 (${res.status})`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}
