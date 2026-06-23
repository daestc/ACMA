exports.getPlansPage = (req, res) => {
  res.render('pages/payment', {
    user:        req.session.user,
    pageTitle:   '플랜',
    currentPage: 'payment',
  });
};

exports.getHistoryPage = (req, res) => {
  res.json({ ok: true, message: '결제 내역 기능 준비 중입니다.' });
};
