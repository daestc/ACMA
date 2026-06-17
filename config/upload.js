const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '../uploads');

const ALLOWED_IMAGE_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE     = 5 * 1024 * 1024; // 5MB
const MAX_LECTURE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const LECTURE_FILE_EXT      = new Set(['.csv', '.xlsx']);

// 업로드 루트 디렉터리 (없으면 생성)
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// 이미지 MIME·확장자 검증
function imageFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_IMAGE_MIME.has(file.mimetype) && ALLOWED_IMAGE_EXT.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.'));
}

// uploads/{subdir}에 UUID 파일명으로 디스크 저장
function createImageStorage(subdir) {
  const dest = path.join(UPLOAD_ROOT, subdir);
  ensureDir(dest);

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_IMAGE_EXT.has(ext) ? ext : '.jpg';
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    },
  });
}

// 단일 이미지 업로드 multer 인스턴스
function createImageMulter(subdir, fieldName) {
  return multer({
    storage: createImageStorage(subdir),
    limits: { fileSize: MAX_IMAGE_SIZE },
    fileFilter: imageFileFilter,
  }).single(fieldName);
}

// .csv, .xlsx 확장자만 허용
function lectureFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (LECTURE_FILE_EXT.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('CSV 또는 XLSX 파일만 업로드할 수 있습니다.'));
}

// 메모리 버퍼에 올려 바로 파싱하는 강의 시간표 multer
function createLectureFileMulter(fieldName) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_LECTURE_FILE_SIZE },
    fileFilter: lectureFileFilter,
  }).single(fieldName);
}

// DB 저장 실패 등 후처리 시 디스크에 남은 파일 삭제
function removeUploadedFile(req) {
  removeUploadedFiles(req);
}

function removeUploadedFiles(req) {
  if (Array.isArray(req.files) && req.files.length) {
    req.files.forEach((file) => {
      if (file?.path) fs.unlink(file.path, () => {});
    });
    return;
  }
  if (req.file?.path) fs.unlink(req.file.path, () => {});
}

// 여러 장 이미지 업로드 multer 인스턴스
function createImageArrayMulter(subdir, fieldName, maxCount = 3) {
  return multer({
    storage: createImageStorage(subdir),
    limits: { fileSize: MAX_IMAGE_SIZE, files: maxCount },
    fileFilter: imageFileFilter,
  }).array(fieldName, maxCount);
}

// errorMiddleware에서 응답 형식을 알 수 있도록 에러에 메타 부착
function attachUploadError(err, options = {}) {
  err.status = 400;
  err.isUploadError = true;
  err.uploadOptions = options;
  return err;
}

// multer 실행 — 오류는 next(err)로 errorMiddleware에 위임
function runUpload(uploadMiddleware, options = {}) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();
      next(attachUploadError(err, options));
    });
  };
}


// 필수 파일 미첨부 시 400 에러
function requireUploadedFile(fieldLabel, options = {}) {
  return (req, res, next) => {
    if (req.file) return next();
    next(attachUploadError(
      new Error(`${fieldLabel}을(를) 첨부해주세요.`),
      options,
    ));
  };
}

const registerUploadOptions = {
  json: false,
  renderPage: 'pages/register',
  title: '회원가입',
};

const verificationMulter = createImageMulter('verifications', 'verificationImage');

const uploadVerificationImage = [
  runUpload(verificationMulter, registerUploadOptions),
  requireUploadedFile('인증 사진', registerUploadOptions),
];

const uploadVerificationImageApi = [
  runUpload(verificationMulter, { json: true }),
  requireUploadedFile('인증 사진', { json: true }),
];

const lectureCsvUploadOptions = { json: true, jsonOk: true };

const lectureCsvMulter = createLectureFileMulter('csvFile');

const uploadLectureCsv = [
  runUpload(lectureCsvMulter, lectureCsvUploadOptions),
  requireUploadedFile('강의 시간표 파일', lectureCsvUploadOptions),
];

const suggestionUploadOptions = { json: true, jsonOk: true };
const suggestionImagesMulter = createImageArrayMulter('suggestions', 'images', 3);

const uploadSuggestionImages = [
  runUpload(suggestionImagesMulter, suggestionUploadOptions),
];

module.exports = {
  UPLOAD_ROOT,
  removeUploadedFile,
  removeUploadedFiles,
  uploadVerificationImage,
  uploadVerificationImageApi,
  uploadLectureCsv,
  uploadSuggestionImages,
};
