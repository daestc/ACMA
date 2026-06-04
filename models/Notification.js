const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * [Notification] 개별 알림 컬렉션
 * 배너 및 알림창에 표시될 사용자별 맞춤 알림 내역
 */
const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true }, // 예: "장학금 마감 D-1"
  body: { type: String, required: true },  
  category: { 
    type: String, 
    enum: ['calendar', 'certification', 'scholarship', 'academic', 'recruit', 'system'] 
  },
  type: { type: String, enum: ['dday', 'reminder', 'popular', 'new_post'] },
  
  // 알림 클릭 시 이동할 원본 데이터 연결 (Notice나 CalendarEvent 모델 동적 참조)
  refModel: { type: String, enum: ['Notice', 'CalendarEvent'], required: true },
  refId: { type: Schema.Types.ObjectId, refPath: 'refModel', required: true },
  
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null }
}, { timestamps: true });

// 딱 Notification 모델 하나만 컴파일해서 내보냅니다.
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;