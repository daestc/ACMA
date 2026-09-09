const { Schema, model } = require('mongoose');

const paymentSchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId:      { type: String, required: true, unique: true },
  paymentKey:   { type: String, default: null },
  orderName:    { type: String, required: true },
  amount:       { type: Number, required: true },
  type:         { type: String, enum: ['premium', 'point'], required: true },
  status:       { type: String, enum: ['pending', 'done', 'canceled', 'failed'], default: 'pending' },
  method:       { type: String, default: null },
  paidAt:       { type: Date, default: null },
  // 프리미엄 전용
  premiumFrom:  { type: Date, default: null },
  premiumUntil: { type: Date, default: null },
  // 포인트 전용
  pointAwarded: { type: Number, default: 0 },
  rawResponse:  { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = model('Payment', paymentSchema);
