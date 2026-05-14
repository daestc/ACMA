function renderTimetable() {
  const grid = document.getElementById('timetable-grid');

  const days = ['월', '화', '수', '목', '금'];
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  grid.innerHTML = `
    <div class="tt-header"></div>
    ${days.map(day => `<div class="tt-header">${day}</div>`).join('')}
  `;

  hours.forEach(hour => {
    grid.innerHTML += `<div class="tt-time">${String(hour).padStart(2, '0')}:00</div>`;

    for (let day = 1; day <= 5; day++) {
      const classes = findTimetableByTime(day, hour);

      grid.innerHTML += `
        <div class="tt-cell">
          ${classes.map(item => `
            <div class="tt-class" style="background:${item.color || '#60A5FA'}">
              ${item.title}
              <br>
              <small>${item.location || ''}</small>
            </div>
          `).join('')}
        </div>
      `;
    }
  });
}

function findTimetableByTime(dayOfWeek, hour) {
  return window.timetables.filter(item => {
    return item.schedule.some(sch => {
      const startHour = Number(sch.startTime.split(':')[0]);
      const endHour = Number(sch.endTime.split(':')[0]);

      return sch.dayOfWeek === dayOfWeek &&
             hour >= startHour &&
             hour < endHour;
    });
  });
}