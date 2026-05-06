const { CalendarEvent } = require('../models/Calendar');

async function getEventsListByUser(userId) {
    return await CalendarEvent.find({ //사용자 id와 삭제되지 않은 일정 가져오기
        userId : userId,
        isDeleted: false,
    }).sort({startDate: 1});
};

async function createNewEvent(userId, eventData) {
    const newEvent = await CalendarEvent.create({
        userId : userId,
        title : eventData.title,
        description : eventData.description || null,
        startDate: eventData.startDate,
        endDate: eventData.endDate || eventData.startDate,
        isAllDay: eventData.isAllDay ?? true,
        category: eventData.category || 'personal',
        isDday: eventData.isDday ?? false,
        color: eventData.color || '#3B82F6',
    });

    return newEvent;
}

module.exports = {getEventsListByUser,createNewEvent};