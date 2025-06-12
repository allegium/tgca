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
  e.target.value = '';
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
  document.getElementById('file-input').value = '';
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
  drawWords();
}

function computeKPIs() {
  const metrics = computeMetrics(filteredMessages);
  window.edgeList = metrics.edgeList;
  window.metrics = metrics;

  const labels = metricLabels;
  const desc = metricDesc;
  const kpiEl = document.getElementById('kpi');
  kpiEl.innerHTML = `
    <h2>\u041a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043c\u0435\u0442\u0440\u0438\u043a\u0438</h2>
    <div class="kpi-cards">
      <div class="kpi-card"><div class="num">${metrics.totalMessages}</div><div>\u0412\u0441\u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 <span class="help" title="${kpiDesc.totalMessages}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.usersCount}</div><div>\u0423\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 <span class="help" title="${kpiDesc.usersCount}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.dauAvg.toFixed(1)}</div><div>DAU <span class="help" title="${kpiDesc.dauAvg}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.wauAvg.toFixed(1)}</div><div>WAU <span class="help" title="${kpiDesc.wauAvg}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.mauAvg.toFixed(1)}</div><div>MAU <span class="help" title="${kpiDesc.mauAvg}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.stickiness}%</div><div>Stickiness <span class="help" title="${kpiDesc.stickiness}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.retention.d1}%</div><div>Avg D1 Retention <span class="help" title="${kpiDesc['retention.d1']}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.retention.d7}%</div><div>Avg D7 Retention <span class="help" title="${kpiDesc['retention.d7']}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.retention.d30}%</div><div>Avg D30 Retention <span class="help" title="${kpiDesc['retention.d30']}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.retention.d90}%</div><div>Avg D90 Retention <span class="help" title="${kpiDesc['retention.d90']}">?</span></div></div>
      <div class="kpi-card"><div class="num">${metrics.lifetime}</div><div>Avg Lifetime(days) <span class="help" title="${kpiDesc.lifetime}">?</span></div></div>
    </div>`;

  let rows = '<tr><th>\u041c\u0435\u0442\u0440\u0438\u043a\u0430</th><th>\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435</th></tr>';
  metricOrder.forEach(key=>{
    const info = desc[key] ? `<span class="help" title="${desc[key]}">?</span>` : '';
    let val = metrics[key];
    let names = '';
    let cls = '';
    if(key==='lowActivity'){names = metrics.lowActivityUsers.join(', '); cls='clickable';}
    if(key==='active5'){names = metrics.active5Users.join(', '); cls='clickable';}
    const namesHtml = names?`<div class="names">${names}</div>`:'';
    rows += `<tr class="${cls}"><td>${labels[key]} ${info}</td><td><span class="num">${val}</span>${namesHtml}</td></tr>`;
  });
  kpiEl.innerHTML += `<table class="metric-table">${rows}</table>`;
  document.querySelectorAll('.metric-table tr.clickable').forEach(tr=>{
    tr.addEventListener('click',()=>{
      const n = tr.querySelector('.names');
      if(n) n.style.display = n.style.display==='block'?'none':'block';
    });
  });

  kpiEl.innerHTML += `<div class="metric-range"><label>\u041f\u0435\u0440\u0438\u043e\u0434 <select id="metric-range"><option value="day">\u0414\u0435\u043d\u044c</option><option value="week">\u041d\u0435\u0434\u0435\u043b\u044f</option><option value="month">\u041c\u0435\u0441\u044f\u0446</option></select></label> <label>\u041c\u0435\u0442\u0440\u0438\u043a\u0430 <select id="metric-select"></select></label><div class="chart-container"><canvas id="metric-chart"></canvas></div></div>`;
  document.getElementById('metric-range').addEventListener('change', e=>renderMetricRange(e.target.value));
  document.getElementById('metric-select').addEventListener('change', e=>renderMetricChart(e.target.value));
  renderMetricRange('day');
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
  const table = document.createElement('table');
  table.className = 'heat-table';
  const head = document.createElement('tr');
  head.innerHTML = '<th></th>' + Array.from({length:24},(_,i)=>`<th>${i}</th>`).join('');
  table.appendChild(head);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const max = Math.max(...heat.flat());
  for(let d=0; d<7; d++){
    const row = document.createElement('tr');
    row.innerHTML = `<th>${days[d]}</th>`;
    for(let h=0; h<24; h++){
      const val = heat[d][h];
      const intensity = val ? Math.round((val/max)*255) : 0;
      row.innerHTML += `<td class="heat-cell" style="background:rgb(255,${255-intensity},${255-intensity})" title="${days[d]} ${h}: ${val}"></td>`;
    }
    table.appendChild(row);
  }
  heatmap.appendChild(table);
}

function drawEngagement() {
  const reactions = {};
  const reactionUsers = {};
  let replyCount = 0;
  const dailyReplies = {};
  const dailyReactions = {};
  filteredMessages.forEach(m => {
    if (m.reactions) {
      m.reactions.forEach(r => {
        reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;
        const u = m.from || 'Unknown';
        reactionUsers[r.reaction] = reactionUsers[r.reaction] || {};
        reactionUsers[r.reaction][u] = (reactionUsers[r.reaction][u] || 0) + 1;
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

  const popular = Object.entries(reactions).sort((a,b)=>b[1]-a[1]).slice(0,10);
  let rows = '<tr><th>Reaction</th><th>Count</th><th>Top User</th></tr>';
  popular.forEach(([r,c])=>{
    const topUser = Object.entries(reactionUsers[r]).sort((a,b)=>b[1]-a[1])[0][0];
    rows += `<tr><td>${r}</td><td>${c}</td><td>${topUser}</td></tr>`;
  });
  el.innerHTML += `<table class="edge-table">${rows}</table>`;
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
  el.innerHTML = '<h2>Reply Network</h2><div id="network-graph"></div>';
  const nodesMap = {};
  window.edgeList.forEach(e=>{nodesMap[e.from]=true; nodesMap[e.to]=true;});
  const nodes = Object.keys(nodesMap).map((n,i)=>({id:i,label:n}));
  const idMap = {}; nodes.forEach(n=>{idMap[n.label]=n.id;});
  const edges = window.edgeList.map(e=>({from:idMap[e.from],to:idMap[e.to],value:e.count,title:`${e.from}→${e.to}: ${e.count}`}));
  new vis.Network(document.getElementById('network-graph'),{nodes:new vis.DataSet(nodes),edges:new vis.DataSet(edges)},{physics:{stabilization:false}});
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

function calcLifetime(msgs = filteredMessages) {
  const users = {};
  msgs.forEach(m => {
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

const metricLabels = {
  mediaCount:'\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0441 \u043c\u0435\u0434\u0438\u0430',
  linkCount:'\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0441\u043e \u0441\u0441\u044b\u043b\u043a\u0430\u043c\u0438',
  avgChars:'\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u0434\u043b\u0438\u043d\u0430 (\u0441\u0438\u043c\u0432.)',
  avgWords:'\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u0434\u043b\u0438\u043d\u0430 (\u0441\u043b\u043e\u0432)',
  longMsgs:'\u0414\u043b\u0438\u043d\u043d\u044b\u0435 >500',
  emojiFreq:'\u041a\u043e\u043b-\u0432\u043e \u044d\u043c\u043e\u0434\u0437\u0438',
  forwarded:'\u041f\u0435\u0440\u0435\u0441\u043b\u0430\u043d\u043d\u044b\u0435',
  replyMsgs:'\u041e\u0442\u0432\u0435\u0442\u044b',
  mentionCount:'\u0423\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u044f',
  questionCount:'\u0412\u043e\u043f\u0440\u043e\u0441\u044b',
  avgTimeFirstReply:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0432\u0440\u0435\u043c\u044f \u043e\u0442\u0432\u0435\u0442\u0430 (\u043c\u0438\u043d)',
  shareNoReplies:'% \u0431\u0435\u0437 \u043e\u0442\u0432\u0435\u0442\u043e\u0432',
  avgThreadDepth:'\u0421\u0440. \u0433\u043b\u0443\u0431\u0438\u043d\u0430 \u0432\u0435\u0442\u043a\u0438',
  avgThreadLifetime:'\u0421\u0440. \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0432\u0435\u0442\u043a\u0438 (\u043c\u0438\u043d)',
  threadCount:'\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0432\u0435\u0442\u043a\u0438',
  density:'\u041f\u043b\u043e\u0442\u043d\u043e\u0441\u0442\u044c \u0441\u0435\u0442\u0438',
  uniquePairs:'\u0423\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u043f\u0430\u0440\u044b',
  lowActivity:'\u041d\u0438\u0437\u043a\u0430\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
  active5:'5+ \u0441\u0432\u044f\u0437\u0435\u0439'
};

const kpiDesc = {
  totalMessages:'\u041e\u0431\u0449\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0432\u044b\u0431\u043e\u0440\u043a\u0435',
  usersCount:'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432',
  dauAvg:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432 \u0434\u0435\u043d\u044c',
  wauAvg:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432 \u043d\u0435\u0434\u0435\u043b\u044e',
  mauAvg:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432 \u043c\u0435\u0441\u044f\u0446',
  stickiness:'DAU/MAU \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c \u0432\u043e\u0432\u043b\u0435\u0447\u0435\u043d\u043d\u043e\u0441\u0442\u0438',
  'retention.d1':'D1 \u0440\u0435\u0442\u0435\u043d\u0448\u043d',
  'retention.d7':'D7 \u0440\u0435\u0442\u0435\u043d\u0448\u043d',
  'retention.d30':'D30 \u0440\u0435\u0442\u0435\u043d\u0448\u043d',
  'retention.d90':'D90 \u0440\u0435\u0442\u0435\u043d\u0448\u043d',
  lifetime:'\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 \u0432 \u0434\u043d\u044f\u0445'
};

const metricDesc = {
  avgThreadLifetime:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0432\u0440\u0435\u043c\u044f \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0432\u044b\u043c \u0438 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u043c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u043c \u0432 \u0432\u0435\u0442\u043a\u0435',
  threadCount:'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0432\u0435\u0442\u043e\u043a \u0441 \u043c\u0438\u043d\u0438\u043c\u0443\u043c \u0434\u0432\u0443\u043c\u044f \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u043c\u0438',
  density:'\u0414\u043e\u043b\u044f \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0445 \u0441\u0432\u044f\u0437\u0435\u0439 \u043a \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u043e \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u044b\u043c',
  lowActivity:'\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u0441 \u043c\u0435\u043d\u0435\u0435 3 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u043c\u0438',
  active5:'\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438, \u0438\u043c\u0435\u044e\u0449\u0438\u0435 \u0431\u043e\u043b\u0435\u0435 5 \u0441\u0432\u044f\u0437\u0435\u0439'
};

const metricOrder = ['mediaCount','linkCount','avgChars','avgWords','longMsgs','emojiFreq','forwarded','replyMsgs','mentionCount','questionCount','avgTimeFirstReply','shareNoReplies','avgThreadDepth','avgThreadLifetime','threadCount','density','uniquePairs','lowActivity','active5'];

function computeMetrics(msgs){
  const totalMessages = msgs.length;
  const users = new Set(msgs.map(m=>m.from_id || m.from));
  const daily = groupByDay(msgs);
  const dau = Object.values(daily).map(day => new Set(day.map(m => m.from_id || m.from)).size);
  const wau = groupByWeek(msgs);
  const mau = groupByMonth(msgs);
  const dauAvg = avg(dau);
  const wauAvg = avg(Object.values(wau).map(w => new Set(w.map(m => m.from_id || m.from)).size));
  const mauAvg = avg(Object.values(mau).map(m => new Set(m.map(mes => mes.from_id || mes.from)).size));
  const stickiness = mauAvg ? (dauAvg / mauAvg * 100).toFixed(1) : 0;
  const retention = calcRetention2(msgs);
  const lifetime = calcLifetime(msgs);

  const text = t => (typeof t === 'string' ? t : Array.isArray(t) ? t.map(p => typeof p === 'string' ? p : p.text || '').join('') : '');

  const mediaCount = msgs.filter(m => m.media_type).length;
  const linkCount = msgs.filter(m => /https?:\/\//i.test(text(m.text))).length;
  const lengths = msgs.map(m => text(m.text).length);
  const wordLengths = msgs.map(m => text(m.text).split(/\s+/).filter(Boolean).length);
  const avgChars = avg(lengths).toFixed(1);
  const avgWords = avg(wordLengths).toFixed(1);
  const longMsgs = lengths.filter(l => l > 500).length;
  const emojiFreq = msgs.reduce((acc,m)=>acc+(text(m.text).match(/\p{Emoji}/gu)||[]).length,0);
  const forwarded = msgs.filter(m => m.forwarded_from).length;
  const replyMsgs = msgs.filter(m => m.reply_to_message_id).length;
  const mentionCount = msgs.reduce((acc,m)=>acc+(text(m.text).match(/@\w+/g)||[]).length,0);
  const questionCount = msgs.filter(m => text(m.text).includes('?')).length;

  const msgById = {};
  msgs.forEach(m=>{ if(m.id) msgById[m.id]=m; });
  const threadStats = {};
  const repliedIds = new Set();
  msgs.forEach(m=>{
    if(m.reply_to_message_id && msgById[m.reply_to_message_id]){
      repliedIds.add(m.reply_to_message_id);
      const parent = msgById[m.reply_to_message_id];
      const tid = m.reply_to_message_id;
      const date = new Date(m.date);
      if(!threadStats[tid]){
        threadStats[tid] = {count:2, first:new Date(parent.date), firstReply:date, last:date};
      }else{
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
  const msgsNoReplies = msgs.filter(m => !repliedIds.has(m.id)).length;
  const shareNoReplies = totalMessages ? (msgsNoReplies/totalMessages*100).toFixed(1) : 0;

  const edges = {};
  const userStats = {};
  msgs.forEach(m=>{
    const u = m.from || 'Unknown';
    userStats[u] = userStats[u] || {messages:0,replies:0,connections:new Set()};
    userStats[u].messages++;
  });
  msgs.forEach(m=>{
    if(m.reply_to_message_id && msgById[m.reply_to_message_id]){
      const from = m.from || 'Unknown';
      const to = msgById[m.reply_to_message_id].from || 'Unknown';
      const key = `${from}\u2192${to}`;
      edges[key] = (edges[key]||0)+1;
      userStats[to].replies++;
      userStats[from].connections.add(to);
      userStats[to].connections.add(from);
    }
  });
  const edgeList = Object.entries(edges).map(([k,v])=>{ const [f,t]=k.split('\u2192'); return {from:f,to:t,count:v};});
  const uniquePairs = edgeList.length;
  const density = users.size>1 ? (uniquePairs/(users.size*(users.size-1))).toFixed(3) : 0;
  const lowActivityUsers = Object.entries(userStats).filter(([u,s])=>s.messages<=2).map(([u])=>u);
  const active5Users = Object.entries(userStats).filter(([u,s])=>s.connections.size>=5).map(([u])=>u);

  return {
    totalMessages, usersCount:users.size, dauAvg, wauAvg, mauAvg, stickiness,
    retention, lifetime,
    mediaCount, linkCount, avgChars, avgWords, longMsgs, emojiFreq, forwarded, replyMsgs,
    mentionCount, questionCount, avgTimeFirstReply, shareNoReplies, avgThreadDepth,
    avgThreadLifetime, threadCount:threadArr.length, density, uniquePairs,
    lowActivity:lowActivityUsers.length, active5:active5Users.length,
    lowActivityUsers, active5Users, edgeList
  };
}

function renderMetricRange(range){
  const groups = range==='day'?groupByDay(filteredMessages):range==='week'?groupByWeek(filteredMessages):groupByMonth(filteredMessages);
  window.metricPeriods = Object.keys(groups).sort();
  window.metricStats = window.metricPeriods.map(p=>computeMetrics(groups[p]));
  const select = document.getElementById('metric-select');
  if(select){
    select.innerHTML = metricOrder.map(k=>`<option value="${k}">${metricLabels[k]}</option>`).join('');
  }
  renderMetricChart(select.value || metricOrder[0]);
}

function renderMetricChart(key){
  const data = window.metricStats.map(s=>s[key]);
  if(charts.metricRange) charts.metricRange.destroy();
  charts.metricRange = new Chart(document.getElementById('metric-chart'),{
    type:'line',
    data:{labels:window.metricPeriods,datasets:[{label:metricLabels[key],data}]},
    options:{responsive:true,maintainAspectRatio:false}
  });
}

function drawWords(){
  const el = document.getElementById('words');
  if(!el) return;
  el.innerHTML = `<h2>Popular Words</h2><label>\u041f\u0435\u0440\u0438\u043e\u0434 <select id="words-range"><option value="day">\u0414\u0435\u043d\u044c</option><option value="week">\u041d\u0435\u0434\u0435\u043b\u044f</option><option value="month">\u041c\u0435\u0441\u044f\u0446</option></select></label><div id="words-table"></div>`;
  document.getElementById('words-range').addEventListener('change',e=>renderWords(e.target.value));
  renderWords('month');
}

const stopWords = new Set(['и','в','во','не','что','он','на','я','с','со','как','а','то','все','она','так','его','но','да','ты','к','у','же','вы','за','бы','по','ее','мне','было','вот','от','меня','еще','нет','о','из','ему','теперь','когда','даже','ну','ли','если','уже','или','ни','быть','был','него','до','вас','нибудь','ваш','твой','есть','the','and','to','of','in','for','with','on','at','by','this','that','it','from','or','as','be']);

function renderWords(range){
  const groups = range==='day'?groupByDay(filteredMessages):range==='week'?groupByWeek(filteredMessages):groupByMonth(filteredMessages);
  const periods = Object.keys(groups).sort().slice(-5);
  const container = document.getElementById('words-table');
  container.innerHTML = '';
  periods.forEach(p=>{
    const words = countWords(groups[p]);
    const top = Object.entries(words).sort((a,b)=>b[1]-a[1]).slice(0,10);
    let rows = '<tr><th>Word</th><th>Count</th></tr>' + top.map(([w,c])=>`<tr><td>${w}</td><td>${c}</td></tr>`).join('');
    container.innerHTML += `<h3>${p}</h3><table class="edge-table">${rows}</table>`;
  });
}

function countWords(msgs){
  const words = {};
  msgs.forEach(m=>{
    const t = (typeof m.text==='string'?m.text: Array.isArray(m.text)?m.text.map(x=>typeof x==='string'?x:x.text||'').join(''):'').toLowerCase();
    t.replace(/[^\p{L}\p{N}\s]/gu,'').split(/\s+/).forEach(w=>{
      if(w.length>2 && !stopWords.has(w)) words[w]= (words[w]||0)+1;
    });
  });
  return words;
}
