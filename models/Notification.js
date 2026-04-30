const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 1. [Notification] 개별 알림 컬렉션
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
  
  // 알림 클릭 시 이동할 원본 데이터 연결
  refModel: { type: String, enum: ['Notice', 'CalendarEvent'], required: true },
  refId: { type: Schema.Types.ObjectId, refPath: 'refModel', required: true },
  
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);


/**
 * 2. [CalendarEvent] 사용자 개인 일정
 */
const calendarEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isDone: { type: Boolean, default: false }, // "체크 안 한 지난 일정" 확인용
}, { timestamps: true });

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);


/**
 * 3. 통합 알림 배너 로직 (Controller)
 */
const getBannerData = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(startOfToday);
    tomorrow.setDate(startOfToday.getDate() + 1);

    // [1] 오늘의 스케줄 (Calendar)
    const todaySchedules = await CalendarEvent.find({
      userId,
      startDate: { $lte: now },
      endDate: { $gte: startOfToday }
    });

    // [2] 체크 안 한 지난 일정
    const missedSchedules = await CalendarEvent.find({
      userId,
      endDate: { $lt: startOfToday },
      isDone: false
    });

    // [3] 맞춤 자격증/장학금 D-1 (Notice 기반)
    const deadlineAlerts = await Notice.find({
      category: { $in: ['certification', 'scholarship'] },
      endDate: { $gte: startOfToday, $lte: tomorrow }
    });

    // [4] 인기 채용 공고 (Scrap 수 기준)
    const hotRecruits = await Notice.find({
      category: 'recruit',
      endDate: { $gte: startOfToday }
    }).sort({ scrapCount: -1 }).limit(3);

    res.json({
      success: true,
      data: {
        todaySchedules,
        missedSchedules,
        deadlineAlerts,
        hotRecruits
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  Notification,
  CalendarEvent,
  getBannerData
};