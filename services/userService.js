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

module.exports = {getTodayTodolist};