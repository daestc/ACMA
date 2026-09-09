import { Link, useSearchParams } from 'react-router-dom'

function PaymentFail() {
  const [searchParams] = useSearchParams()
  const message = searchParams.get('message') || '결제가 취소되었습니다.'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>✕</div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>결제에 실패했습니다</h2>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 28 }}>{message}</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link to="/home" style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, textDecoration: 'none' }}>홈으로</Link>
          <Link to="/payment" style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#534AB7', color: '#fff', fontSize: 14, textDecoration: 'none' }}>다시 시도</Link>
        </div>
      </div>
    </div>
  )
}

export default PaymentFail
