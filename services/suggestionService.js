const Suggestion = require('../models/Suggestion');

const CATEGORY_LABELS = {
  academic: '학사',
  facility: '시설',
  service: '서비스',
  other: '기타',
};

const STATUS_LABELS = {
  pending: '처리중',
  completed: '처리완료',
};

const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS);

function requireUniversity(university) {
  const value = university?.trim();
  if (!value) {
    const err = new Error('소속 대학 정보가 없습니다.');
    err.code = 'NO_UNIVERSITY';
    throw err;
  }
  return value;
}

function formatSuggestion(doc) {
  if (!doc) return null;
  const item = doc.toObject ? doc.toObject() : doc;
  const imageUrls = (item.images || []).map((imagePath) => (
    imagePath.startsWith('/') ? imagePath : `/uploads/${imagePath}`
  ));
  return {
    ...item,
    categoryName: CATEGORY_LABELS[item.category] || '기타',
    statusName: STATUS_LABELS[item.status] || item.status,
    imageUrls,
    hasImages: imageUrls.length > 0,
  };
}

async function createSuggestion({ university, authorId, authorName, category, title, content, images = [] }) {
  const univ = requireUniversity(university);

  if (!title?.trim()) {
    const err = new Error('제목을 입력해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!content?.trim()) {
    const err = new Error('내용을 입력해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }

  const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'other';

  const suggestion = await Suggestion.create({
    university: univ,
    authorId,
    authorName: authorName?.trim() || '학생',
    category: safeCategory,
    title: title.trim(),
    content: content.trim(),
    images: images.slice(0, 3),
    status: 'pending',
  });

  return formatSuggestion(suggestion);
}

async function getStudentSuggestions(authorId, university) {
  requireUniversity(university);

  const items = await Suggestion.find({ authorId, university: university.trim() })
    .sort({ createdAt: -1 })
    .lean();

  return items.map(formatSuggestion);
}

async function getStudentSuggestionById(id, authorId, university) {
  requireUniversity(university);

  const item = await Suggestion.findOne({
    _id: id,
    authorId,
    university: university.trim(),
  }).lean();

  if (!item) {
    const err = new Error('건의글을 찾을 수 없습니다.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return formatSuggestion(item);
}

async function getUniversitySuggestions(university, { status } = {}) {
  const univ = requireUniversity(university);
  const filter = { university: univ };

  if (status === 'pending' || status === 'completed') {
    filter.status = status;
  }

  const items = await Suggestion.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return items.map(formatSuggestion);
}

async function getUniversitySuggestionById(id, university) {
  const univ = requireUniversity(university);

  const item = await Suggestion.findOne({ _id: id, university: univ }).lean();
  if (!item) {
    const err = new Error('건의글을 찾을 수 없습니다.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return formatSuggestion(item);
}

async function replyToSuggestion(id, university, { reply, repliedBy, repliedByName }) {
  const univ = requireUniversity(university);

  if (!reply?.trim()) {
    const err = new Error('답변 내용을 입력해주세요.');
    err.code = 'VALIDATION';
    throw err;
  }

  const updated = await Suggestion.findOneAndUpdate(
    { _id: id, university: univ },
    {
      staffReply: reply.trim(),
      repliedBy,
      repliedByName: repliedByName?.trim() || '대학관계자',
      repliedAt: new Date(),
      status: 'completed',
    },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) {
    const err = new Error('건의글을 찾을 수 없습니다.');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return formatSuggestion(updated);
}

module.exports = {
  CATEGORY_LABELS,
  STATUS_LABELS,
  VALID_CATEGORIES,
  createSuggestion,
  getStudentSuggestions,
  getStudentSuggestionById,
  getUniversitySuggestions,
  getUniversitySuggestionById,
  replyToSuggestion,
};
