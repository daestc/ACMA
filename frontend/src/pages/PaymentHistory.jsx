import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function PaymentHistory() {
  const [payments, setPayments] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/payment/history/data')
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setPayments(data.payments || []) })
      .catch((err) => console.error('결제 내역 로딩 실패:', err))
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>결제 내역</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>최근 50건의 결제 내역</p>
        </div>
        <Link to="/payment" style={{ fontSize: 13, color: 'var(--text2)', textDecoration: 'none' }}>← 플랜 페이지</Link>
      </div>

      {payments === null ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)', fontSize: 14 }}>불러오는 중...</div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)', fontSize: 14 }}>결제 내역이 없습니다.</div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>결제일시</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>상품명</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>결제수단</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>금액</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>구분</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p._id} style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)', fontSize: 12 }}>
                    {p.paidAt ? new Date(p.paidAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.orderName}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{p.method || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{p.amount.toLocaleString()}원</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {p.type === 'premium' ? (
                      <span style={{ fontSize: 11, background: '#EEEDFE', color: '#3C3489', padding: '2px 10px', borderRadius: 20 }}>프리미엄</span>
                    ) : (
                      <span style={{ fontSize: 11, background: '#E1F5EE', color: '#0F6E56', padding: '2px 10px', borderRadius: 20 }}>포인트</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default PaymentHistory
