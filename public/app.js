let rawMessages = [];
let filteredMessages = [];
let charts = {};

document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', handleFiles);

const uploadArea = document.getElementById('upload-area');
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

function handleFiles(e) {
  const file = e.target.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      rawMessages = data.messages || [];
      document.getElementById('dashboard').classList.remove('hidden');
      applyFilters();
    } catch (err) {
      alert('Invalid JSON');
    }
  };
  reader.readAsText(file);
}

document.getElementById('apply-filters').addEventListener('click', applyFilters);

function applyFilters() {
  const fromDate = document.getElementById('from-date').value;
  const toDate = document.getElementById('to-date').value;
  const type = document.getElementById('content-type').value;
  filteredMessages = rawMessages.filter(m => {
    if (m.type !== 'message') return false;
    if (type === 'media' && !m.media_type) return false;
    const d = new Date(m.date);
    if (fromDate && d < new Date(fromDate)) return false;
    if (toDate && d > new Date(toDate)) return false;
    return true;
  });
  renderDashboard();
}

function renderDashboard() {
  computeKPIs();
  drawActivity();
  drawEngagement();
  drawMembers();
}

function computeKPIs() {
  const totalMessages = filteredMessages.length;
  const users = new Set(filteredMessages.map(m => m.from_id || m.from));
  const daily = groupByDay(filteredMessages);
  const dau = Object.values(daily).map(day => new Set(day.map(m => m.from_id || m.from)).size);
  const wau = groupByWeek(filteredMessages);
  const mau = groupByMonth(filteredMessages);
  const dauAvg = avg(dau);
  const wauAvg = avg(Object.values(wau).map(w => new Set(w.map(m => m.from_id || m.from)).size));
  const mauAvg = avg(Object.values(mau).map(m => new Set(m.map(mes => mes.from_id || mes.from)).size));
  const stickiness = mauAvg ? (dauAvg / mauAvg * 100).toFixed(1) : 0;
  const retention = calcRetention();
  const lifetime = calcLifetime();

  const kpiEl = document.getElementById('kpi');
  kpiEl.innerHTML = `
    <h2>Key Metrics</h2>
    <div class="kpi-cards">
      <div class="kpi-card"><div class="num">${totalMessages}</div><div>Total Messages</div></div>
      <div class="kpi-card"><div class="num">${users.size}</div><div>Unique Participants</div></div>
      <div class="kpi-card"><div class="num">${dauAvg.toFixed(1)}</div><div>DAU</div></div>
      <div class="kpi-card"><div class="num">${wauAvg.toFixed(1)}</div><div>WAU</div></div>
      <div class="kpi-card"><div class="num">${mauAvg.toFixed(1)}</div><div>MAU</div></div>
      <div class="kpi-card"><div class="num">${stickiness}%</div><div>Stickiness</div></div>
      <div class="kpi-card"><div class="num">${retention.d1}%</div><div>Avg D1 Retention</div></div>
      <div class="kpi-card"><div class="num">${retention.d7}%</div><div>Avg D7 Retention</div></div>
      <div class="kpi-card"><div class="num">${lifetime}</div><div>Avg Lifetime (days)</div></div>
    </div>`;
}

function drawActivity() {
  const daily = groupByDay(filteredMessages);
  const dates = Object.keys(daily).sort();
  const msgCounts = dates.map(d => daily[d].length);
  const dauCounts = dates.map(d => new Set(daily[d].map(m => m.from_id || m.from)).size);

  const hours = Array(24).fill(0);
  filteredMessages.forEach(m => {
    const h = new Date(m.date).getHours();
    hours[h]++;
  });

  const heat = Array(7).fill(0).map(() => Array(24).fill(0));
  filteredMessages.forEach(m => {
    const d = new Date(m.date);
    heat[d.getDay()][d.getHours()]++;
  });

  const el = document.getElementById('activity');
  el.innerHTML = `<h2>Activity Dynamics</h2>
    <div class="chart-container"><canvas id="activity-chart"></canvas></div>
    <div class="chart-container"><canvas id="hour-chart"></canvas></div>
    <div class="heatmap" id="heatmap"></div>`;

  if (charts.activity) charts.activity.destroy();
  charts.activity = new Chart(document.getElementById('activity-chart'), {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: 'Messages', data: msgCounts, borderColor: 'blue', yAxisID: 'y' },
        { label: 'DAU', data: dauCounts, borderColor: 'red', yAxisID: 'y1' }
      ]
    },
    options: {
      scales: {
        y: { type: 'linear', position: 'left' },
        y1: { type: 'linear', position: 'right' }
      }
    }
  });

  if (charts.hours) charts.hours.destroy();
  charts.hours = new Chart(document.getElementById('hour-chart'), {
    type: 'bar',
    data: {
      labels: hours.map((_, i) => i),
      datasets: [{ label: 'Messages by Hour', data: hours, backgroundColor: 'green' }]
    },
    options: { scales: { x: { title: { display: true, text: 'Hour' } } } }
  });

  const heatmap = document.getElementById('heatmap');
  heatmap.innerHTML = '';
  const max = Math.max(...heat.flat());
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const val = heat[d][h];
      const div = document.createElement('div');
      const intensity = val ? Math.round((val / max) * 255) : 0;
      div.style.backgroundColor = `rgb(255,${255-intensity},${255-intensity})`;
      div.title = `Day ${d}, Hour ${h}: ${val}`;
      heatmap.appendChild(div);
    }
  }
}

function drawEngagement() {
  const reactions = { '👍': 0, '❤️': 0, '🔥': 0, '😂': 0 };
  let replyCount = 0;
  const dailyReplies = {};
  const dailyReactions = {};
  filteredMessages.forEach(m => {
    if (m.reactions) {
      m.reactions.forEach(r => {
        if (reactions.hasOwnProperty(r.reaction)) reactions[r.reaction]++;
        const day = m.date.slice(0,10);
        dailyReactions[day] = (dailyReactions[day] || 0) + 1;
      });
    }
    if (m.reply_to_message_id) {
      replyCount++;
      const day = m.date.slice(0,10);
      dailyReplies[day] = (dailyReplies[day] || 0) + 1;
    }
  });
  const totalReactions = Object.values(reactions).reduce((a,b)=>a+b,0);
  const engagementRate = ((totalReactions + replyCount) / filteredMessages.length * 100).toFixed(1);

  const days = Array.from(new Set([...Object.keys(dailyReplies), ...Object.keys(dailyReactions)])).sort();
  const repliesSeries = days.map(d => dailyReplies[d] || 0);
  const reactionsSeries = days.map(d => dailyReactions[d] || 0);

  const el = document.getElementById('engagement');
  el.innerHTML = `<h2>Engagement</h2>
    <div class="chart-container"><canvas id="reaction-chart"></canvas></div>
    <div class="chart-container"><canvas id="reply-chart"></canvas></div>
    <p>Engagement Rate: <strong>${engagementRate}%</strong></p>`;

  if (charts.reactions) charts.reactions.destroy();
  charts.reactions = new Chart(document.getElementById('reaction-chart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(reactions),
      datasets: [{ data: Object.values(reactions), backgroundColor: ['#4caf50','#e91e63','#ff9800','#03a9f4'] }]
    }
  });

  if (charts.replies) charts.replies.destroy();
  charts.replies = new Chart(document.getElementById('reply-chart'), {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        { label: 'Replies', data: repliesSeries, backgroundColor: '#03a9f4' },
        { label: 'Reactions', data: reactionsSeries, backgroundColor: '#ff9800' }
      ]
    },
    options: { scales: { x: { stacked: true }, y: { stacked: false } } }
  });
}

function drawMembers() {
  const userStats = {};
  filteredMessages.forEach(m => {
    const u = m.from || 'Unknown';
    userStats[u] = userStats[u] || { messages: 0, reactions: 0 };
    userStats[u].messages++;
    if (m.reactions) userStats[u].reactions += m.reactions.length;
  });
  const topMsg = Object.entries(userStats).sort((a,b) => b[1].messages - a[1].messages).slice(0,10);
  const topEng = Object.entries(userStats).filter(e=>e[1].messages>=1).map(([u,s])=>({user:u,val:s.reactions/s.messages})).sort((a,b)=>b.val-a.val).slice(0,10);

  const el = document.getElementById('members');
  el.innerHTML = `<h2>Member Analysis</h2>
    <div id="top-msg"></div>
    <div id="top-eng"></div>
    <div class="chart-container"><canvas id="scatter"></canvas></div>`;

  renderHorizontalBar('top-msg', topMsg.map(e => e[0]), topMsg.map(e=>e[1].messages), 'Top 10 by Messages');
  renderHorizontalBar('top-eng', topEng.map(e => e.user), topEng.map(e=>e.val.toFixed(2)), 'Top 10 by Engagement');

  const scatterData = Object.entries(userStats).map(([u,s])=>({x:s.messages,y:s.reactions}));
  if (charts.scatter) charts.scatter.destroy();
  charts.scatter = new Chart(document.getElementById('scatter'), {
    type: 'scatter',
    data: {
      datasets: [{ label: 'User Activity', data: scatterData }]
    },
    options: { scales: { x: { title:{display:true,text:'Messages'}}, y:{ title:{display:true,text:'Reactions'} } } }
  });
}

function renderHorizontalBar(container, labels, data, title) {
  const div = document.getElementById(container);
  div.innerHTML = `<h3>${title}</h3>`;
  labels.forEach((l,i) => {
    const row = document.createElement('div');
    row.className = 'bar-horizontal';
    row.innerHTML = `<span class="label">${l}</span><div class="bar" style="width:${data[i]}%"></div><span>${data[i]}</span>`;
    div.appendChild(row);
  });
}

function groupByDay(msgs) {
  return msgs.reduce((acc,m)=>{
    const d = m.date.slice(0,10);
    acc[d] = acc[d] || [];
    acc[d].push(m);
    return acc;
  },{});
}

function groupByWeek(msgs) {
  return msgs.reduce((acc,m)=>{
    const d = new Date(m.date);
    const week = `${d.getFullYear()}-W${getWeek(d)}`;
    acc[week] = acc[week] || [];
    acc[week].push(m);
    return acc;
  },{});
}

function groupByMonth(msgs) {
  return msgs.reduce((acc,m)=>{
    const d = m.date.slice(0,7);
    acc[d] = acc[d] || [];
    acc[d].push(m);
    return acc;
  },{});
}

function getWeek(d) {
  const onejan = new Date(d.getFullYear(),0,1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
}

function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}

function calcRetention() {
  const users = {};
  filteredMessages.forEach(m => {
    const u = m.from_id || m.from;
    const d = new Date(m.date);
    users[u] = users[u] || [];
    users[u].push(d);
  });
  const d1 = []; const d7 = [];
  Object.values(users).forEach(dates => {
    dates.sort((a,b)=>a-b);
    const first = dates[0];
    const hasD1 = dates.some(dt => diffDays(first, dt) === 1);
    const hasD7 = dates.some(dt => diffDays(first, dt) === 7);
    d1.push(hasD1?1:0);
    d7.push(hasD7?1:0);
  });
  return { d1: (avg(d1)*100).toFixed(1), d7: (avg(d7)*100).toFixed(1) };
}

function calcLifetime() {
  const users = {};
  filteredMessages.forEach(m => {
    const u = m.from_id || m.from;
    const d = new Date(m.date);
    users[u] = users[u] || {first:d,last:d};
    if (d < users[u].first) users[u].first = d;
    if (d > users[u].last) users[u].last = d;
  });
  const spans = Object.values(users).map(u => diffDays(u.first, u.last)+1);
  return avg(spans).toFixed(1);
}

function diffDays(a,b){return Math.round((b-a)/86400000);}
