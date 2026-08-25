const axios = require('axios');

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

function getSecretKey() {
  return process.env.TOSS_SECRET_KEY?.trim() || '';
}

function getClientKey() {
  return process.env.TOSS_CLIENT_KEY?.trim() || '';
}

function getAuthHeader() {
  const secretKey = getSecretKey();
  if (!secretKey) {
    const err = new Error('토스페이먼츠 Secret Key가 설정되지 않았습니다.');
    err.code = 'NO_TOSS_KEY';
    throw err;
  }

  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

async function confirmPayment({ paymentKey, orderId, amount }) {
  const response = await axios.post(
    `${TOSS_API_BASE}/payments/confirm`,
    { paymentKey, orderId, amount: Number(amount) },
    {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
    },
  );

  return response.data;
}

module.exports = {
  getClientKey,
  getSecretKey,
  confirmPayment,
};
