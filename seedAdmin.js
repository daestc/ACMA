/* ================================================
   관리자 계정 승격 스크립트
   사용법: node seedAdmin.js 이메일주소
   해당 이메일의 기존 계정을 admin 역할로 변경한다.
   ================================================ */
require('dotenv').config();
const connectDB = require('./config/database');
const User = require('./models/User');

const email = process.argv[2];

if (!email) {
  console.error('사용법: node seedAdmin.js 이메일주소');
  process.exit(1);
}

(async () => {
  try {
    await connectDB();
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { role: 'admin' },
      { returnDocument: 'after' }
    );

    if (!user) {
      console.error(`❌ 해당 이메일의 계정이 없습니다: ${email}`);
      process.exit(1);
    }

    console.log(`✅ ${user.name} (${user.email}) 계정이 관리자로 변경되었습니다.`);
    process.exit(0);
  } catch (err) {
    console.error('실패:', err.message);
    process.exit(1);
  }
})();
