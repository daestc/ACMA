const mongoose = require('mongoose');
const User = require('../models/User');

// 사용자의 오늘 자 todolist 가져오기. userId로 변경가능
async function getTodayTodolist(userEmail) {

  const user = await User.findOne({email: userEmail});
  if(!user) return [];

  // 오늘의 시작과 끝 시간 구하기
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0); // 오늘 00:00:00

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999); // 오늘 23:59:59


  // '오늘' 범위에 들어가는 할 일만 필터링
  const todolist = user.todolist.filter(todo => {
    const todayDate = new Date(todo.doDay);
    return todayDate >= todayStart && todayDate <= todayEnd;
  });

  return todolist;
} // getTodayTodolist()

// 사용자의 todolist기져오기. userId로 변경가능
async function getTodolist(userEmail, dayDate) {

  const user = await User.findOne({email: userEmail});
  if(!user) return [];

  // 당일의 시작과 끝 시간 구하기
  const targetDate = new Date(dayDate);

  const dayStart = new Date(targetDate).setHours(0, 0, 0, 0); // 당일 00:00:00

  const todayEnd = new Date(targetDate).setHours(23, 59, 59, 999); // 당일 23:59:59


  // 당일 범위에 들어가는 할 일만 필터링
  const todolist = user.todolist.filter(todo => {
    const todayDate = new Date(todo.doDay);
    return todayDate >= todayStart && todayDate <= todayEnd;
  });

  return todolist;
} // getTodolist()

// todo 항목 추가
async function addTodo(userEmail, content, note) {
  
  const updatedUser = await User.findOneAndUpdate(
    {email: userEmail}, 
    {
      $push: {
        todolist: {
          title: content,
          note
        }
      }
    },
    // 추가한 User 데이터 가져오기
    {returnDocument: 'after'}
  );

  const lastTodo = updatedUser.todolist[updatedUser.todolist.length - 1];

  return lastTodo._id;
} // addTodo()

// todo 항목 배열 삭제
async function deleteTodo(userEmail, deleteTodoList) {

  // deleteTodoList에 있는 모든 todo._Id 삭제
  await User.findOneAndUpdate(
    { email: userEmail },
    {
      $pull: {
        todolist: {
          _id: { $in: deleteTodoList } 
        }
      }
    }
  );
} // deleteTodo()

module.exports = {getTodayTodolist, getTodolist, addTodo, deleteTodo};