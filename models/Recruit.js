// 채용 및 인턴 // models/Recruit.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const recruitSchema = new mongoose.Schema({
    company: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String, // 예: '서울 서초구'
        trim: true
    },
    requirements: {
        type: String, // 예: '신입·경력 / 학력무관'
        trim: true
    },
    url: {
        type: String,
        required: true,
        unique: true 
    },
    deadlineText: {
        type: String, // 예: '상시채용', '~ 08/30(금)' 등 원본 텍스트
    },
    endDate: {
        type: Date, // 나중에 D-Day 계산을 위해 Date 형식으로 파싱해서 넣을 필드
        default: null
    },
    salary: {
        type: String, 
        default: '면접 후 결정', 
        trim: true
    },
    source: {
        type: String,
        default: 'saramin' // 출처 표시 (나중에 다른 사이트 추가를 대비)
    },
    isPublished: {
        type: Boolean,
        default: true
    },
    saraminCategory: { type: String, default: "" },
    region: { type: String, default: "" },
    experience: { type: String, default: "" },
    education: { type: String, default: "" },
    
    acmaCategory: { type: String, default: "" },
    isAiProcessed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Recruit', recruitSchema, 'Recruits');