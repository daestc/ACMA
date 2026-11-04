// User.major에 "주전공-복수전공"으로 합쳐 저장된 학생을 주전공(User.major)과 복수전공
// (UniversityProfile.doubleMajor)으로 나눈다. 예전 마이페이지가 입력칸 하나("주전공-복수전공")를
// 통째로 User.major에 저장했다.
// 실행: node scripts/splitDoubleMajor.js           (기본 dry-run — 나눌 결과를 표로만 출력)
//       node scripts/splitDoubleMajor.js --apply   (실제 저장)
// 학과 이름 자체에 "-"가 들어갈 수 있어서, dry-run 표를 사람이 본 뒤에 적용한다.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const UniversityProfile = require('../models/University_profile');

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find({ role: 'student', major: /-/ }).select('email major').lean();
  const profiles = await UniversityProfile.find({ userId: { $in: users.map(u => u._id) } })
    .select('userId doubleMajor')
    .lean();
  const profileByUser = new Map(profiles.map(p => [String(p.userId), p]));

  const targets = [];
  const skipped = [];
  users.forEach(user => {
    if (profileByUser.get(String(user._id))?.doubleMajor) return; // 이미 나뉜 학생
    const parts = user.major.split('-').map(s => s.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      skipped.push({ user, reason: parts.length > 2 ? '"-"가 두 개 이상' : '한쪽이 빈값' });
      return;
    }
    targets.push({ user, primary: parts[0], double: parts[1] });
  });

  console.log(`대상 ${targets.length}명, 건너뜀 ${skipped.length}명${apply ? '' : ' (dry-run, 쓰기 없음)'}`);
  if (targets.length) {
    console.log('이메일 | 현재 User.major | → 주전공 | → 복수전공');
    targets.forEach(({ user, primary, double }) => console.log(`${user.email} | ${user.major} | ${primary} | ${double}`));
  }
  if (skipped.length) {
    console.log('\n건너뜀 (직접 확인 필요):');
    skipped.forEach(({ user, reason }) => console.log(`${user.email} | ${user.major} | ${reason}`));
  }

  if (apply && targets.length) {
    for (const { user, primary, double } of targets) {
      await User.updateOne({ _id: user._id }, { $set: { major: primary } });
      await UniversityProfile.updateOne(
        { userId: user._id },
        { $set: { major: primary, doubleMajor: double }, $setOnInsert: { userId: user._id } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
    console.log(`\n반영 완료: ${targets.length}명`);
  }

  await mongoose.connection.close();
}

main().catch(async error => {
  console.error('❌ 분리 실패:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
