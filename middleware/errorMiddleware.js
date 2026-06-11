const notFoundHandler = (req, res) => {
    res.status(404).render('pages/error', { title: '페이지를 찾을 수 없습니다.', status: 404, error: null });
};

const errorHandler = (err, req, res, next) => {
    console.error(`[${req.method}] ${req.originalUrl}`);
    console.error(err.stack);

    if (err.status === 403) {
        res.status(403).render('pages/error', { title: '권한이 없습니다.', status: 403, error: err.message });
    } else if (err.status === 404) {
        res.status(404).render('pages/error', { title: '페이지를 찾을 수 없습니다.', status: 404, error: err.message });
    } else {
        res.status(500).render('pages/error', { title: '서버 오류가 발생했습니다.', status: 500, error: err.message });
    }
};

module.exports = { notFoundHandler, errorHandler };
