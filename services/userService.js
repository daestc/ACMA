const mongoose = require('mongoose');
const User = require('../models/User');

// 사용자의 오늘 자 todoList 가져오기. userId로 변경가능
async function getTodaytodoList(userEmail) {

  const user = await User.findOne({email: userEmail});
  if(!user) return [];

  // 오늘의 시작과 끝 시간 구하기
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0); // 오늘 00:00:00

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999); // 오늘 23:59:59


  // '오늘' 범위에 들어가는 할 일만 필터링
  const todoList = user.todoList.filter(todo => {
    const todayDate = new Date(todo.doDay);
    return todayDate >= todayStart && todayDate <= todayEnd;
  });

  return todoList;
} // getTodaytodoList()

// 사용자의 todoList기져오기. userId로 변경가능
async function gettodoList(userEmail, dayDate) {

  const user = await User.findOne({email: userEmail});
  if(!user) return [];

  // 당일의 시작과 끝 시간 구하기
  const targetDate = new Date(dayDate);

  const dayStart = new Date(targetDate).setHours(0, 0, 0, 0); // 당일 00:00:00

  const todayEnd = new Date(targetDate).setHours(23, 59, 59, 999); // 당일 23:59:59


  // 당일 범위에 들어가는 할 일만 필터링
  const todoList = user.todoList.filter(todo => {
    const todayDate = new Date(todo.doDay);
    return todayDate >= todayStart && todayDate <= todayEnd;
  });

  return todoList;
} // gettodoList()

// todo 항목 추가
async function addTodo(userEmail, content, note) {
  
  const updatedUser = await User.findOneAndUpdate(
    {email: userEmail}, 
    {
      $push: {
        todoList: {
          title: content,
          note
        }
      }
    },
    // 추가한 User 데이터 가져오기
    {returnDocument: 'after'}
  );

  const lastTodo = updatedUser.todoList[updatedUser.todoList.length - 1];

  return lastTodo._id;
} // addTodo()

// todo 항목 배열 삭제
async function deleteTodo(userEmail, deletetodoList) {

  // deletetodoList에 있는 모든 todo._Id 삭제
  await User.findOneAndUpdate(
    { email: userEmail },
    {
      $pull: {
        todoList: {
          _id: { $in: deletetodoList } 
        }
      }
    }
  );
} // deleteTodo()

// habit 리스트 가져오기
async function getHabitList(userEmail) {
  const user = await User.findOne({email: userEmail});
  if(!user) throw new Error('사용자를 찾지 못했습니다.');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0); // 오늘 00:00:00

  const habitList = user.habitTracker;
  habitList.forEach(h => {
    if(h.lastUpdatedDate < todayStart) {
      h.isCompleted = false;
    }
  });
  const completedCount = habitList.filter(habit => habit.isCompleted).length;

  return {habitList, completedCount};
}

// habit 추가하기
async function addHabit(userEmail, title, category) {
  
  const updatedUser = await User.findOneAndUpdate(
    {email: userEmail}, 
    {
      $push: {
        habitTracker: {
          title,
          category
        }
      }
    },
    // 추가한 User 데이터 가져오기
    {returnDocument: 'after'}
  );

  const lastHabit = updatedUser.habitTracker[updatedUser.habitTracker.length - 1];

  return lastHabit._id;
}

// habit 수정하기
async function editHabit(userEmail, habitId, title, category) {
  return await User.findOneAndUpdate(
    {
      email: userEmail,
      "habitTracker._id": habitId
    }, 
    {
      $set: {
        habitTracker: {
          "habitTracker.$.title": title,
          "habitTracker.$.category": category
        }
      }
    },
  );
}

// habit 삭제하기
async function deleteHabit(userEmail, habitId) {
  return await User.findOneAndUpdate(
    { email: userEmail },
    {
      $pull: {
        habitTracker: {
          _id: { $in: habitId } 
        }
      }
    }
  );
}

// isCompleted 변경 사항 DB에 저장
async function saveIsCompleted(userEmail, changes) {
  for(const [habitId, isCompleted] of Object.entries(changes)) {
    await User.findOneAndUpdate(
      { 
        email: userEmail,
        "habitTracker._id": habitId 
      },
      { 
        $set: {
            "habitTracker.$.isCompleted": isCompleted
          }
      }
    );
  } // for
}

async function updateProfile(userEmail, profileData) {
  try {
    const { studentId, university, major, enrollmentStatus } = profileData;
    await User.findOneAndUpdate(
      { email: userEmail },
      { studentId, university, major, enrollmentStatus }
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}
async function getProfile(userEmail) {
  try {
    const user = await User.findOne({ email: userEmail });
    if (!user) throw new Error('사용자를 찾지 못했습니다.');

    return {
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      university: user.university,
      major: user.major,
      enrollmentStatus: user.enrollmentStatus
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

module.exports = {getTodaytodoList, gettodoList, addTodo, deleteTodo, getHabitList, addHabit ,editHabit, deleteHabit, saveIsCompleted, updateProfile, getProfile};