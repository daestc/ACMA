import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const POINT_AMOUNTS = [1000, 3000, 5000, 10000, 30000]

function loadTossScript() {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) {
      resolve(window.TossPayments)
      return
    }
    const existing = document.querySelector('script[src="https://js.tosspayments.com/v1/payment"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.TossPayments))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v1/payment'
    script.onload = () => resolve(window.TossPayments)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

function Payment() {
  const [data, setData] = useState(null) // { user, clientKey }
  const [tossPayments, setTossPayments] = useState(null)
  const [pointModalOpen, setPointModalOpen] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/payment/plan-data')
      .then((res) => res.json())
      .then((json) => { if (!cancelled && json.ok) setData(json) })
      .catch((err) => console.error('플랜 페이지 로딩 실패:', err))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!data?.clientKey) return
    loadTossScript()
      .then((TossPayments) => {
        try {
          setTossPayments(TossPayments(data.clientKey))
        } catch {
          // 원본도 try/catch로 조용히 무시 — clientKey가 비어있는 개발 환경 등을 대비.
        }
      })
      .catch(() => {})
  }, [data?.clientKey])

  const user = data?.user

  async function startPremium() {
    if (!tossPayments) return
    try {
      const res = await fetch('/payment/checkout/premium', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const checkout = await res.json()
      if (!checkout.ok) {
        alert(checkout.message || '오류가 발생했습니다.')
        return
      }
      await tossPayments.requestPayment('카드', {
        amount: checkout.amount,
        orderId: checkout.orderId,
        orderName: checkout.orderName,
        customerName: user.name,
        successUrl: `${window.location.origin}/payment/confirm`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch (e) {
      if (e?.code !== 'USER_CANCEL') alert('결제 중 오류가 발생했습니다.')
    }
  }

  function chargePoints() {
    setPointModalOpen(true)
  }
  function closePointModal() {
    setPointModalOpen(false)
    setSelectedPoint(0)
  }

  async function startPoint() {
    if (!selectedPoint || !tossPayments) return
    try {
      const res = await fetch('/payment/checkout/point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedPoint }),
      })
      const checkout = await res.json()
      if (!checkout.ok) {
        alert(checkout.message || '오류가 발생했습니다.')
        return
      }
      closePointModal()
      await tossPayments.requestPayment('카드', {
        amount: checkout.amount,
        orderId: checkout.orderId,
        orderName: checkout.orderName,
        customerName: user.name,
        successUrl: `${window.location.origin}/payment/confirm`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch (e) {
      if (e?.code !== 'USER_CANCEL') alert('결제 중 오류가 발생했습니다.')
    }
  }

  if (!user) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>불러오는 중...</div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const quizUsed = user.dailyUsage?.quiz?.date === today ? (user.dailyUsage.quiz.count || 0) : 0
  const sumUsed = user.dailyUsage?.summary?.date === today ? (user.dailyUsage.summary.count || 0) : 0

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>구독 플랜</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)' }}>현재 이용 중인 플랜과 사용량을 확인하고 업그레이드할 수 있습니다.</p>
      </div>

      {user.planType !== 'premium' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>오늘 퀴즈 사용량</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{quizUsed}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)' }}> / 10회</span></div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round((quizUsed / 10) * 100))}%`, background: '#534AB7', borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>오늘 요약 사용량</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{sumUsed}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)' }}> / 5회</span></div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.round((sumUsed / 5) * 100))}%`, background: '#1D9E75', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 24 }}>🌱</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>무료</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>₩0<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)' }}> / 월</span></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>기본 AI 기능 무료 제공.<br />일 제한 내에서 자유롭게 이용</p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>퀴즈 하루 10회</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>요약 하루 5회</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>자정(00:00) 자동 초기화</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}><span>✗</span>무제한 이용</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}><span>✗</span>포트폴리오 AI 생성</li>
          </ul>
          {user.planType !== 'premium' ? (
            <button type="button" style={{ padding: 10, borderRadius: 10, border: '1.5px solid #1D9E75', background: 'transparent', color: '#0F6E56', fontSize: 13, fontWeight: 600, cursor: 'default' }}>현재 플랜</button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', padding: 10 }} onClick={() => { if (confirm('무료 플랜으로 전환하시겠습니까?')) alert('해지 기능 준비 중입니다.') }}>무료로 전환</button>
          )}
        </div>

        <div style={{ background: 'var(--bg2)', border: '2px solid #534AB7', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
          <span style={{ position: 'absolute', top: 16, right: 16, background: '#EEEDFE', color: '#3C3489', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>추천</span>
          <div style={{ fontSize: 24 }}>👑</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>프리미엄</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>₩9,900<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)' }}> / 월</span></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>모든 AI 기능 무제한.<br />제한 없이 학습에 집중</p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>퀴즈 무제한</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>요약 무제한</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>포트폴리오 AI 생성 <span style={{ fontSize: 11, color: 'var(--text2)' }}>(출시 예정)</span></li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>월 정기 결제 / 언제든 해지</li>
          </ul>
          {user.planType === 'premium' ? (
            <button type="button" style={{ padding: 10, borderRadius: 10, border: 'none', background: '#534AB7', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'default' }}>현재 플랜</button>
          ) : (
            <button type="button" style={{ padding: 10, borderRadius: 10, border: 'none', background: '#534AB7', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={startPremium}>프리미엄 시작</button>
          )}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 24 }}>🪙</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>포인트 충전</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>₩100<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)' }}> / 회</span></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>한도 초과 시 포인트로<br />즉시 추가 이용</p>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>보유 포인트</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{(user.pointBalance || 0).toLocaleString()}원</div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>퀴즈 · 요약 모두 적용</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>잔여 포인트 자동 차감</li>
            <li style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>유효기간 없음</li>
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', padding: 10 }} onClick={chargePoints}>포인트 충전</button>
        </div>
      </div>

      <div style={{ borderLeft: '3px solid #534AB7', borderRadius: '0 12px 12px 0', background: 'var(--bg2)', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>무료 플랜 쿨타임 안내</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          퀴즈 10회 / 요약 5회는 매일 자정(00:00)에 초기화됩니다.<br />
          한도를 초과한 경우 포인트로 즉시 이용하거나, 프리미엄으로 전환하면 제한 없이 사용할 수 있습니다.
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <Link to="/payment/history" style={{ fontSize: 13, color: 'var(--text2)', textDecoration: 'none' }}>결제 내역 보기 →</Link>
      </div>

      {pointModalOpen && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(23,25,43,.5)', zIndex: 1000, backdropFilter: 'blur(4px)', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) closePointModal() }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, width: 380, maxWidth: '95vw', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>포인트 충전</span>
              <button type="button" onClick={closePointModal} style={{ width: 30, height: 30, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text2)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {POINT_AMOUNTS.map((amt) => {
                const isSelected = selectedPoint === amt
                return (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setSelectedPoint(amt)}
                    style={{ padding: 14, borderRadius: 10, border: `1px solid ${isSelected ? '#534AB7' : 'var(--border)'}`, background: isSelected ? '#EEEDFE' : 'var(--bg3)', color: isSelected ? '#3C3489' : undefined, cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all .12s' }}
                  >
                    {amt.toLocaleString()}원
                  </button>
                )
              })}
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
              선택한 금액: <strong style={{ color: 'var(--text1)' }}>{selectedPoint ? `${selectedPoint.toLocaleString()}원` : '-'}</strong>
            </div>
            <button
              type="button"
              onClick={startPoint}
              disabled={!selectedPoint}
              style={{ width: '100%', height: 44, borderRadius: 12, border: 'none', background: '#534AB7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: selectedPoint ? 1 : .5 }}
            >
              충전하기
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default Payment
