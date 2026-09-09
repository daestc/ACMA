function showSubMsg(text, isError) {
  const box = document.getElementById('sub-msg');
  if (!box) return;
  box.style.display = 'block';
  box.style.background = isError ? 'var(--bg3)' : 'var(--green-bg)';
  box.style.border = `1px solid ${isError ? 'var(--border2)' : 'var(--green)'}`;
  box.style.color = isError ? 'var(--text)' : 'var(--green)';
  box.textContent = text;
}

function updateUsageUI(status) {
  const usedEl = document.getElementById('ai-used-count');
  const limitEl = document.getElementById('ai-limit-count');
  const barEl = document.getElementById('ai-usage-bar');

  if (usedEl) usedEl.textContent = status.aiUsed;
  if (limitEl) limitEl.textContent = status.aiLimit;
  if (barEl) {
    const pct = status.aiLimit ? Math.min(100, Math.round((status.aiUsed / status.aiLimit) * 100)) : 0;
    barEl.style.width = `${pct}%`;
  }
}

async function startCheckout(planId) {
  try {
    const res = await fetch('/subscription/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId }),
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || '결제 준비에 실패했습니다.');
      return;
    }

    const { checkout } = data;

    if (!window.TossPayments) {
      alert('토스페이먼츠 SDK를 불러오지 못했습니다.');
      return;
    }

    const tossPayments = TossPayments(checkout.clientKey);
    const payment = tossPayments.payment({ customerKey: checkout.customerEmail || TossPayments.ANONYMOUS });

    await payment.requestPayment({
      method: 'CARD',
      amount: {
        currency: 'KRW',
        value: checkout.amount,
      },
      orderId: checkout.orderId,
      orderName: checkout.orderName,
      successUrl: checkout.successUrl,
      failUrl: checkout.failUrl,
      customerEmail: checkout.customerEmail,
      customerName: checkout.customerName,
    });
  } catch (err) {
    if (err?.code === 'USER_CANCEL') return;
    alert(err?.message || '결제창 실행 중 오류가 발생했습니다.');
  }
}

async function testAiUse() {
  try {
    const res = await fetch('/subscription/ai/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 }),
    });
    const data = await res.json();

    if (data.ok) {
      updateUsageUI(data.status);
      showSubMsg(`AI 1회 사용 완료. 남은 횟수: ${data.status.aiRemaining}회`, false);
    } else {
      if (data.status) updateUsageUI(data.status);
      showSubMsg(data.message || 'AI 사용에 실패했습니다.', true);
    }
  } catch {
    showSubMsg('서버와 통신할 수 없습니다.', true);
  }
}

async function cancelSubscription() {
  if (!confirm('무료 플랜으로 변경하시겠습니까? (세션 기준)')) return;

  try {
    const res = await fetch('/subscription/cancel', { method: 'POST' });
    const data = await res.json();

    if (data.ok) {
      alert(data.message);
      window.location.reload();
    } else {
      alert(data.message || '변경에 실패했습니다.');
    }
  } catch {
    alert('서버와 통신할 수 없습니다.');
  }
}

window.startCheckout = startCheckout;
window.testAiUse = testAiUse;
window.cancelSubscription = cancelSubscription;

