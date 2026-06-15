const multer = require('multer');

const notFoundHandler = (req, res) => {
    res.status(404).render('pages/error', { title: '페이지를 찾을 수 없습니다.', status: 404, error: null });
};

function isUploadError(err) {
    return err instanceof multer.MulterError || err.isUploadError === true;
}

function getUploadErrorMessage(err) {
    if (!(err instanceof multer.MulterError)) {
        return err.message || '파일 업로드 중 오류가 발생했습니다.';
    }

    switch (err.code) {
        case 'LIMIT_FILE_SIZE':
            return '파일 크기는 5MB 이하여야 합니다.';
        case 'LIMIT_UNEXPECTED_FILE':
            return '허용되지 않은 파일 필드입니다.';
        default:
            return '파일 업로드 중 오류가 발생했습니다.';
    }
}

function respondUploadError(err, res) {
    const message = getUploadErrorMessage(err);
    const options = err.uploadOptions || {};

    if (options.json) {
        const payload = options.jsonOk
            ? { ok: false, message }
            : { success: false, message };
        return res.status(400).json(payload);
    }

    return res.status(400).render(options.renderPage || 'pages/register', {
        title: options.title || '회원가입',
        error: message,
    });
}

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (isUploadError(err)) {
        return respondUploadError(err, res);
    }

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
