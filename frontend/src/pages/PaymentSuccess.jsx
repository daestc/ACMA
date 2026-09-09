import { Link, useSearchParams } from 'react-router-dom'

function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  const until = searchParams.get('until')
  const amount = searchParams.get('amount')

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>✓</div>

        {type === 'premium' ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>프리미엄 구독 완료!</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 6 }}>이제 퀴즈·요약을 무제한으로 이용할 수 있습니다.</p>
            {until && <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>구독 만료일: <strong style={{ color: 'var(--text1)' }}>{until}</strong></p>}
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>포인트 충전 완료!</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 28 }}><strong style={{ color: '#534AB7' }}>{Number(amount).toLocaleString()}원</strong>이 충전되었습니다.</p>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link to="/payment" style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, textDecoration: 'none' }}>플랜 페이지</Link>
          <Link to="/home" style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#534AB7', color: '#fff', fontSize: 14, textDecoration: 'none' }}>홈으로</Link>
        </div>
      </div>
    </div>
  )
}

export default PaymentSuccess
