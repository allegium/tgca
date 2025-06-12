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
  drawNetwork();
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
  const retention = calcRetention2(filteredMessages);
  const lifetime = calcLifetime();

  const text = t => (typeof t === 'string' ? t : Array.isArray(t) ? t.map(p => typeof p === 'string' ? p : p.text || '').join('') : '');

  const mediaCount = filteredMessages.filter(m => m.media_type).length;
  const linkCount = filteredMessages.filter(m => /https?:\/\//i.test(text(m.text))).length;
  const lengths = filteredMessages.map(m => text(m.text).length);
  const wordLengths = filteredMessages.map(m => text(m.text).split(/\s+/).filter(Boolean).length);
  const avgChars = avg(lengths).toFixed(1);
  const avgWords = avg(wordLengths).toFixed(1);
  const longMsgs = lengths.filter(l => l > 500).length;
  const emojiFreq = filteredMessages.reduce((acc,m)=>acc+(text(m.text).match(/\p{Emoji}/gu)||[]).length,0);
  const forwarded = filteredMessages.filter(m => m.forwarded_from).length;
  const replyMsgs = filteredMessages.filter(m => m.reply_to_message_id).length;
  const mentionCount = filteredMessages.reduce((acc,m)=>acc+(text(m.text).match(/@\w+/g)||[]).length,0);
  const questionCount = filteredMessages.filter(m => text(m.text).includes('?')).length;

  const msgById = {};
  filteredMessages.forEach(m => { if(m.id) msgById[m.id]=m; });
  const threadStats = {};
  const repliedIds = new Set();
  filteredMessages.forEach(m => {
    if(m.reply_to_message_id && msgById[m.reply_to_message_id]){
      repliedIds.add(m.reply_to_message_id);
      const parent = msgById[m.reply_to_message_id];
      const tid = m.reply_to_message_id;
      const date = new Date(m.date);
      if(!threadStats[tid]){
        threadStats[tid] = {count:2, first:new Date(parent.date), firstReply:date, last:date};
      } else {
        threadStats[tid].count++;
        if(date < threadStats[tid].firstReply) threadStats[tid].firstReply = date;
        if(date > threadStats[tid].last) threadStats[tid].last = date;
      }
    }
  });
  const threadArr = Object.values(threadStats);
  const avgThreadDepth = threadArr.length ? avg(threadArr.map(t=>t.count)).toFixed(1) : 0;
  const avgThreadLifetime = threadArr.length ? avg(threadArr.map(t=>diffMinutes(t.first, t.last))).toFixed(1) : 0;
  const avgTimeFirstReply = threadArr.length ? avg(threadArr.map(t=>diffMinutes(t.first, t.firstReply))).toFixed(1) : 0;
  const msgsNoReplies = filteredMessages.filter(m => !repliedIds.has(m.id)).length;
  const shareNoReplies = totalMessages ? (msgsNoReplies/totalMessages*100).toFixed(1) : 0;

  const edges = {};
  const userStats = {};
  filteredMessages.forEach(m=>{
    const u = m.from || 'Unknown';
    userStats[u] = userStats[u] || {messages:0,replies:0,connections:new Set()};
    userStats[u].messages++;
  });
  filteredMessages.forEach(m=>{
    if(m.reply_to_message_id && msgById[m.reply_to_message_id]){
      const from = m.from || 'Unknown';
      const to = msgById[m.reply_to_message_id].from || 'Unknown';
      const key = `${from}→${to}`;
      edges[key] = (edges[key]||0)+1;
      userStats[to].replies++;
      userStats[from].connections.add(to);
      userStats[to].connections.add(from);
    }
  });
  const edgeList = Object.entries(edges).map(([k,v])=>{ const [f,t]=k.split('→'); return {from:f,to:t,count:v};});
  const uniquePairs = edgeList.length;
  const density = users.size>1 ? (uniquePairs/(users.size*(users.size-1))).toFixed(3) : 0;
  const leaderCentrality = Object.entries(userStats).map(([u,s])=>({user:u,replies:s.replies})).sort((a,b)=>b.replies-a.replies).slice(0,5);
  const lowActivity = Object.values(userStats).filter(s=>s.messages<=2).length;
  const active5 = Object.values(userStats).filter(s=>s.connections.size>=5).length;

  window.edgeList = edgeList;
  window.metrics = {
    mediaCount,linkCount,avgChars,avgWords,longMsgs,emojiFreq,forwarded,replyMsgs,
    mentionCount,avgTimeFirstReply,shareNoReplies,avgThreadDepth,avgThreadLifetime,
    uniquePairs,density,leaderCentrality,lowActivity,active5,questionCount
  };

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
      <div class="kpi-card"><div class="num">${retention.d30}%</div><div>Avg D30 Retention</div></div>
      <div class="kpi-card"><div class="num">${retention.d90}%</div><div>Avg D90 Retention</div></div>
      <div class="kpi-card"><div class="num">${lifetime}</div><div>Avg Lifetime(days)</div></div>
    </div>
    <table class="metric-table">
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Messages with media</td><td>${mediaCount}</td></tr>
      <tr><td>Messages with links</td><td>${linkCount}</td></tr>
      <tr><td>Average length (chars)</td><td>${avgChars}</td></tr>
      <tr><td>Average length (words)</td><td>${avgWords}</td></tr>
      <tr><td>Long messages >500</td><td>${longMsgs}</td></tr>
      <tr><td>Emoji count</td><td>${emojiFreq}</td></tr>
      <tr><td>Forwarded messages</td><td>${forwarded}</td></tr>
      <tr><td>Reply messages</td><td>${replyMsgs}</td></tr>
      <tr><td>User mentions</td><td>${mentionCount}</td></tr>
      <tr><td>Questions</td><td>${questionCount}</td></tr>
      <tr><td>Avg time to first reply (min)</td><td>${avgTimeFirstReply}</td></tr>
      <tr><td>Share without replies</td><td>${shareNoReplies}%</td></tr>
      <tr><td>Avg thread depth</td><td>${avgThreadDepth}</td></tr>
      <tr><td>Avg thread lifetime (min)</td><td>${avgThreadLifetime}</td></tr>
      <tr><td>Active threads</td><td>${threadArr.length}</td></tr>
      <tr><td>Network density</td><td>${density}</td></tr>
      <tr><td>Unique reply pairs</td><td>${uniquePairs}</td></tr>
      <tr><td>Low activity users</td><td>${lowActivity}</td></tr>
      <tr><td>Active users 5+ ties</td><td>${active5}</td></tr>
    </table>`;
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
  const reactions = {};
  let replyCount = 0;
  const dailyReplies = {};
  const dailyReactions = {};
  filteredMessages.forEach(m => {
    if (m.reactions) {
      m.reactions.forEach(r => {
        reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;
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
  const rLabels = Object.keys(reactions);
  const colors = rLabels.map((_,i)=>`hsl(${i*40},70%,60%)`);
  charts.reactions = new Chart(document.getElementById('reaction-chart'), {
    type: 'doughnut',
    data: {
      labels: rLabels,
      datasets: [{ data: Object.values(reactions), backgroundColor: colors }]
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

function drawNetwork(){
  const el = document.getElementById('network');
  el.innerHTML = '<h2>Reply Network (edge list)</h2><pre>'+JSON.stringify(window.edgeList.slice(0,50),null,2)+'</pre>';
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

function calcRetention2(msgs){
  const users = {};
  msgs.forEach(m=>{
    const u = m.from_id || m.from;
    const d = new Date(m.date);
    users[u] = users[u] || [];
    users[u].push(d);
  });
  const res = {1:0,7:0,30:0,90:0};
  let count = 0;
  Object.values(users).forEach(dates=>{
    dates.sort((a,b)=>a-b);
    const first = dates[0];
    const check = {1:false,7:false,30:false,90:false};
    dates.forEach(dt=>{
      const diff = diffDays(first,dt);
      if(res.hasOwnProperty(diff)) check[diff]=true;
    });
    Object.keys(check).forEach(k=>{ if(check[k]) res[k]++; });
    count++;
  });
  return {
    d1: (res[1]/count*100).toFixed(1),
    d7: (res[7]/count*100).toFixed(1),
    d30: (res[30]/count*100).toFixed(1),
    d90: (res[90]/count*100).toFixed(1)
  };
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

function diffMinutes(a,b){return Math.round((b-a)/60000);}
