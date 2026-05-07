// checkData.js
require('dotenv').config();
const connectDB = require('./config/database');
const {Certification} = require('./models/Certifications_jobs');

async function main() {
  await connectDB();
  
  // checkData.js 수정
const result = await Certification.aggregate([
  { 
    $group: { 
      _id: { f1: "$field1", f2: "$field2" }, 
      count: { $sum: 1 } 
    } 
  },
  { $sort: { "_id.f1": 1, count: -1 } }
]);

  console.log(JSON.stringify(result, null, 2));
  
  process.exit(0);
}

main();