let rawMessages = [];
let filteredMessages = [];
let charts = {};

function extractText(t){
  if(typeof t==='string') return t;
  if(Array.isArray(t)) return t.map(p=>typeof p==='string'?p:(p.text||'')).join('');
  return '';
}

function toggleNames(key){
  const el=document.getElementById(key+'-names');
  if(el) el.classList.toggle('hidden');
}



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
  const formulas = metricFormulas;
  const kpiEl = document.getElementById('kpi');
  let kpiHtml = '<h2>\u041a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043c\u0435\u0442\u0440\u0438\u043a\u0438</h2><div class="kpi-cards">';
  function formatVal(key){
    if(key.startsWith('retention.')) return metrics.retention[key.split('.')[1]] + '%';
    if(key==='dauAvg'||key==='wauAvg'||key==='mauAvg') return metrics[key].toFixed(1);
    if(key==='stickiness') return metrics.stickiness + '%';
    return metrics[key];
  }
  kpiInfo.forEach(def=>{
    const tip=[def.desc,def.formula].filter(Boolean).join(' ');
    kpiHtml += `<div class="kpi-card"><div class="num">${formatVal(def.key)}</div><div>${def.label} <span class="info" title="${tip}">?</span></div></div>`;
  });
  kpiHtml += '</div>';
  kpiEl.innerHTML = kpiHtml;

  let kpiOptions = kpiOrder.map(k=>`<option value="${k}">${kpiLabels[k]}</option>`).join('');
  kpiEl.innerHTML += `<div class="chart-container"><label>\u041a\u043b\u044e\u0447\u0435\u0432\u0430\u044f \u043c\u0435\u0442\u0440\u0438\u043a\u0430 <select id=\"kpi-select\">${kpiOptions}</select></label><label>\u041f\u0435\u0440\u0438\u043e\u0434 <select id=\"kpi-chart-range\"><option value=\"day\">\u0414\u0435\u043d\u044c</option><option value=\"month\">\u041c\u0435\u0441\u044f\u0446</option><option value=\"year\">\u0413\u043e\u0434</option></select></label><canvas id=\"kpi-chart\"></canvas></div>`;
  document.getElementById('kpi-select').addEventListener('change',()=>renderKpiChart());
  document.getElementById('kpi-chart-range').addEventListener('change',()=>renderKpiChart());
  renderKpiChart();

  const metricsEl = document.getElementById('metrics');
  metricsEl.innerHTML = '<h2>\u041c\u0435\u0442\u0440\u0438\u043a\u0438</h2>';

  let rows = '<tr><th>\u041c\u0435\u0442\u0440\u0438\u043a\u0430</th><th>\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435</th></tr>';
  metricOrder.forEach(key=>{
    const tip = [desc[key], formulas[key]].filter(Boolean).join(' ');
    const title = tip ? ` title="${tip}"` : '';
    let val = metrics[key];
    if(key==='lowActivity'){
      val = `<span class="clickable" onclick=\"toggleNames('lowActivity')\">${metrics.lowActivity}</span><div id=\"lowActivity-names\" class=\"hidden\">${metrics.lowActivityUsers.join(', ')}</div>`;
    }
    if(key==='active5'){
      val = `<span class="clickable" onclick=\"toggleNames('active5')\">${metrics.active5}</span><div id=\"active5-names\" class=\"hidden\">${metrics.active5Users.join(', ')}</div>`;
    }
    rows += `<tr><td${title}>${labels[key]} <span class="info" title="${tip}">?</span></td><td>${val}</td></tr>`;
  });
  metricsEl.innerHTML += `<table class="metric-table">${rows}</table>`;

  metricsEl.innerHTML += `<div class="metric-range"><label for=\"metric-range-select\">\u041f\u0435\u0440\u0438\u043e\u0434</label> <select id=\"metric-range-select\"><option value=\"day\">\u0414\u0435\u043d\u044c</option><option value=\"month\">\u041c\u0435\u0441\u044f\u0446</option><option value=\"year\">\u0413\u043e\u0434</option></select><div id=\"metric-range-table\"></div></div>`;
  const rangeSelect = document.getElementById('metric-range-select');
  rangeSelect.addEventListener('change', () => renderMetricRange(rangeSelect.value));
  renderMetricRange(rangeSelect.value);

  let metricOptions = metricOrder.map(k=>`<option value=\"${k}\">${labels[k]}</option>`).join('');
  metricsEl.innerHTML += `<div class="chart-container"><label>\u041c\u0435\u0442\u0440\u0438\u043a\u0430 <select id=\"metric-select\">${metricOptions}</select></label><label>\u041f\u0435\u0440\u0438\u043e\u0434 <select id=\"metric-chart-range\"><option value=\"day\">\u0414\u0435\u043d\u044c</option><option value=\"month\">\u041c\u0435\u0441\u044f\u0446</option><option value=\"year\">\u0413\u043e\u0434</option></select></label><canvas id=\"metric-chart\"></canvas></div>`;
  document.getElementById('metric-select').addEventListener('change',()=>renderMetricChart());
  document.getElementById('metric-chart-range').addEventListener('change',()=>renderMetricChart());
  renderMetricChart();
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
    <div id="top-eng"></div>`;

  renderHorizontalBar('top-msg', topMsg.map(e => e[0]), topMsg.map(e=>e[1].messages), 'Top 10 by Messages');
  renderHorizontalBar('top-eng', topEng.map(e => e.user), topEng.map(e=>e.val.toFixed(2)), 'Top 10 by Engagement');

}

function drawNetwork(){
  const el = document.getElementById('network');
  el.innerHTML = '<h2>Reply Network <span class="info" title="\u0412\u0437\u0430\u0438\u043c\u043e\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u043c\u0435\u0436\u0434\u0443 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430\u043c\u0438">?</span></h2><div id="network-chart"></div>';
  const nodes = {};
  window.edgeList.forEach(e=>{nodes[e.from]=true;nodes[e.to]=true;});
  const dataNodes = Object.keys(nodes).map((n,i)=>({id:i,label:n}));
  const idMap = Object.fromEntries(dataNodes.map(n=>[n.label,n.id]));
  const dataEdges = window.edgeList.map(e=>({from:idMap[e.from],to:idMap[e.to],value:e.count,title:`${e.from}→${e.to}: ${e.count}`}));
  const options = {
    nodes:{shape:'dot',size:12,color:{background:'#89CFF0',border:'#2B7CE9'},font:{color:'#000'}},
    edges:{arrows:'to',color:{color:'#555'},width:2,smooth:{type:'dynamic'}},
    physics:{solver:'forceAtlas2Based',springLength:200,springConstant:0.02},
    interaction:{hover:true}
  };
  const net = new vis.Network(document.getElementById('network-chart'),{nodes:new vis.DataSet(dataNodes),edges:new vis.DataSet(dataEdges)},options);
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

function groupByYear(msgs) {
  return msgs.reduce((acc,m)=>{
    const y = m.date.slice(0,4);
    acc[y] = acc[y] || [];
    acc[y].push(m);
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

const metricDesc = {
  mediaCount:'\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0447\u0430\u0442\u0435 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442 \u0444\u0430\u0439\u043b\u044b \u0438\u043b\u0438 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f. \u0427\u0438\u0441\u043b\u043e \u0442\u0430\u043a\u0438\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u2013 \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u043c\u0435\u0442\u0440\u0438\u043a\u0438.',
  linkCount:'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0441\u043e \u0441\u0441\u044b\u043b\u043a\u0430\u043c\u0438. \u0421\u0447\u0438\u0442\u0430\u0435\u043c \u0432\u0441\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f, \u0432 \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u043f\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 http-\u0441\u0441\u044b\u043b\u043a\u0430.',
  avgChars:'\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u0434\u043b\u0438\u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u0441\u0438\u043c\u0432\u043e\u043b\u0430\u0445: \u0441\u0443\u043c\u043c\u0430 \u0434\u043b\u0438\u043d \u0434\u0435\u043b\u0438\u0442\u0441\u044f \u043d\u0430 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.',
  avgWords:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0441\u043b\u043e\u0432 \u0432 \u043e\u0434\u043d\u043e\u043c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0438: \u0441\u0443\u043c\u043c\u0430 \u0441\u043b\u043e\u0432 \u0434\u0435\u043b\u0438\u0442\u0441\u044f \u043d\u0430 \u043e\u0431\u0449\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.',
  longMsgs:'\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0434\u043b\u0438\u043d\u043d\u0435\u0435 500 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.',
  emojiFreq:'\u041e\u0431\u0449\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u044d\u043c\u043e\u0434\u0437\u0438 \u0432\u043e \u0432\u0441\u0435\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\u0445.',
  forwarded:'\u0427\u0438\u0441\u043b\u043e \u043f\u0435\u0440\u0435\u0441\u043b\u0430\u043d\u043d\u044b\u0445 \u0438\u0437 \u0434\u0440\u0443\u0433\u0438\u0445 \u0447\u0430\u0442\u043e\u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.',
  replyMsgs:'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439-\u043e\u0442\u0432\u0435\u0442\u043e\u0432.',
  mentionCount:'\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0440\u0430\u0437 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u0443\u043f\u043e\u043c\u0438\u043d\u0430\u043b\u0438 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0430 \u0447\u0435\u0440\u0435\u0437 @.',
  questionCount:'\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f, \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0449\u0438\u0435 \u0437\u043d\u0430\u043a \u0432\u043e\u043f\u0440\u043e\u0441\u0430.',
  avgTimeFirstReply:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0432\u0440\u0435\u043c\u044f \u043e\u0442 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0434\u043e \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043e\u0442\u0432\u0435\u0442\u0430 \u0432 \u0432\u0435\u0442\u043a\u0435.',
  shareNoReplies:'\u0414\u043e\u043b\u044f \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0431\u0435\u0437 \u043e\u0442\u0432\u0435\u0442\u043e\u0432: \u0447\u0438\u0441\u043b\u043e \u0431\u0435\u0437\u043e\u0442\u0432\u0435\u0442\u043d\u044b\u0445 \u0434\u0435\u043b\u0438\u043c \u043d\u0430 \u043e\u0431\u0449\u0435\u0435 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0438 \u0443\u043c\u043d\u043e\u0436\u0430\u0435\u043c \u043d\u0430 100%.',
  avgThreadDepth:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432 \u043e\u0434\u043d\u043e\u0439 \u0432\u0435\u0442\u043a\u0435.',
  avgThreadLifetime:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0432\u0440\u0435\u043c\u044f \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0432\u044b\u043c \u0438 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u043c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u043c \u0432 \u0432\u0435\u0442\u043a\u0435.',
  threadCount:'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0432\u0435\u0442\u043e\u043a, \u0433\u0434\u0435 \u0435\u0441\u0442\u044c \u043c\u0438\u043d\u0438\u043c\u0443\u043c \u0434\u0432\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.',
  density:'\u041e\u0442\u043d\u043e\u0448\u0435\u043d\u0438\u0435 \u0447\u0438\u0441\u043b\u0430 \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u043f\u0430\u0440 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043e\u0442\u0432\u0435\u0447\u0430\u043b\u0438 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443, \u043a \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u043e \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u043c\u0443 N(N-1). \u0427\u0435\u043c \u0431\u043e\u043b\u0435\u0435 \u043f\u043e\u0445\u043e\u0436\u0435 \u043d\u0430 1, \u0442\u0435\u043c \u0433\u0443\u0449\u0435 \u0441\u0435\u0442\u044c \u043e\u0431\u0449\u0435\u043d\u0438\u044f.',
  uniquePairs:'\u0427\u0438\u0441\u043b\u043e \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u043f\u0430\u0440 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439, \u043e\u0431\u043c\u0435\u043d\u044f\u0432\u0448\u0438\u0445\u0441\u044f \u043e\u0442\u0432\u0435\u0442\u0430\u043c\u0438.',
  lowActivity:'\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u043d\u0430\u043f\u0438\u0441\u0430\u043b\u0438 \u0434\u0432\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0438\u043b\u0438 \u043c\u0435\u043d\u044c\u0448\u0435.',
  active5:'\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439 \u0441 \u043f\u044f\u0442\u044c\u044e \u0438 \u0431\u043e\u043b\u0435\u0435 \u0441\u0432\u044f\u0437\u044f\u043c\u0438 \u0441 \u0434\u0440\u0443\u0433\u0438\u043c\u0438 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430\u043c\u0438.'
};

const metricFormulas = {
  mediaCount:'Количество сообщений, содержащих фото, видео или файлы.',
  linkCount:'Количество сообщений, в тексте которых есть ссылки.',
  avgChars:'Суммируем длину всех сообщений и делим на их количество \u2013 получаем среднее число символов.',
  avgWords:'Сумма количества слов во всех сообщениях делится на число сообщений.',
  longMsgs:'Сколько сообщений длиннее 500 символов.',
  emojiFreq:'Общее число эмодзи, встретившихся в переписке.',
  forwarded:'Число пересланных сообщений из других чатов.',
  replyMsgs:'Количество сообщений, являющихся ответами на другие.',
  mentionCount:'Сколько раз участники упоминали друг друга через @.',
  questionCount:'Количество сообщений со знаком вопроса.',
  avgTimeFirstReply:'Среднее время в минутах от первого сообщения до первого ответа в ветке.',
  shareNoReplies:'Доля сообщений без ответов: число таких сообщений делим на общее и умножаем на 100%.',
  avgThreadDepth:'Среднее количество сообщений в одной ветке.',
  avgThreadLifetime:'Сколько минут в среднем проходит между первым и последним сообщением ветки.',
  threadCount:'Число веток, содержащих минимум два сообщения.',
  density:'Делим количество уникальных связей между пользователями на N*(N-1), где N \u2013 число участников. Так получаем долю реализованных связей.',
  uniquePairs:'Количество уникальных пар участников, обменявшихся ответами.',
  lowActivity:'Сколько участников отправили два сообщения или меньше.',
  active5:'Число пользователей, у которых не менее пяти разных связей.'
};

const metricOrder = ['mediaCount','linkCount','avgChars','avgWords','longMsgs','emojiFreq','forwarded','replyMsgs','mentionCount','questionCount','avgTimeFirstReply','shareNoReplies','avgThreadDepth','avgThreadLifetime','threadCount','density','uniquePairs','lowActivity','active5'];

const kpiInfo = [
  {key:'totalMessages',label:'\u0412\u0441\u0435\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',desc:'\u041e\u0431\u0449\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',formula:'\u041f\u0440\u043e\u0441\u0442\u043e \u043f\u043e\u0434\u0441\u0447\u0451\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.'},
  {key:'usersCount',label:'\u0423\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438',desc:'\u0427\u0438\u0441\u043b\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439, \u043d\u0430\u043f\u0438\u0441\u0430\u0432\u0448\u0438\u0445 \u043e\u0434\u043d\u043e \u0438\u043b\u0438 \u0431\u043e\u043b\u0435\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.',formula:'\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u0430\u0432\u0442\u043e\u0440\u043e\u0432.'},
  {key:'dauAvg',label:'DAU',desc:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432 \u0434\u0435\u043d\u044c',formula:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u043f\u043e \u0434\u043d\u044f\u043c \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0445 \u0430\u0432\u0442\u043e\u0440\u043e\u0432.'},
  {key:'wauAvg',label:'WAU',desc:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432 \u043d\u0435\u0434\u0435\u043b\u044e',formula:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u043f\u043e \u043d\u0435\u0434\u0435\u043b\u044f\u043c \u0447\u0438\u0441\u043b\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439.'},
  {key:'mauAvg',label:'MAU',desc:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0447\u0438\u0441\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0432 \u043c\u0435\u0441\u044f\u0446',formula:'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u043f\u043e \u043c\u0435\u0441\u044f\u0446\u0430\u043c \u0447\u0438\u0441\u043b\u0430 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432.'},
  {key:'stickiness',label:'Stickiness',desc:'\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c \u0440\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u043e\u0441\u0442\u0438',formula:'DAU/MAU*100'},
  {key:'retention.d1',label:'Avg D1 Retention',desc:'\u0414\u043e\u043b\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439, \u0432\u0435\u0440\u043d\u0443\u0432\u0448\u0438\u0445\u0441\u044f \u0447\u0435\u0440\u0435\u0437 1 \u0434\u0435\u043d\u044c',formula:'(\u0427\u0438\u0441\u043b\u043e \u0432\u0435\u0440\u043d\u0443\u0432\u0448\u0438\u0445\u0441\u044f/\u0412\u0441\u0435)*100'},
  {key:'retention.d7',label:'Avg D7 Retention',desc:'\u0414\u043e\u043b\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439, \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u0438\u0432\u0448\u0438\u0445\u0441\u044f \u0447\u0435\u0440\u0435\u0437 7 \u0434\u043d\u0435\u0439',formula:'(\u0427\u0438\u0441\u043b\u043e \u0432\u0435\u0440\u043d\u0443\u0432\u0448\u0438\u0445\u0441\u044f/\u0412\u0441\u0435)*100'},
  {key:'retention.d30',label:'Avg D30 Retention',desc:'\u0414\u043e\u043b\u044f \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u043e\u0432 \u0447\u0435\u0440\u0435\u0437 30 \u0434\u043d\u0435\u0439',formula:'(\u0427\u0438\u0441\u043b\u043e \u0432\u0435\u0440\u043d\u0443\u0432\u0448\u0438\u0445\u0441\u044f/\u0412\u0441\u0435)*100'},
  {key:'retention.d90',label:'Avg D90 Retention',desc:'\u0414\u043e\u043b\u044f \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u043e\u0432 \u0447\u0435\u0440\u0435\u0437 90 \u0434\u043d\u0435\u0439',formula:'(\u0427\u0438\u0441\u043b\u043e \u0432\u0435\u0440\u043d\u0443\u0432\u0448\u0438\u0445\u0441\u044f/\u0412\u0441\u0435)*100'},
  {key:'lifetime',label:'Avg Lifetime(days)',desc:'\u0421\u0440\u0435\u0434\u043d\u044f\u044f \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0436\u0438\u0437\u043d\u0438 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',formula:'\u0420\u0430\u0437\u043d\u0438\u0446\u0430 \u043c\u0435\u0436\u0434\u0443 \u043f\u0435\u0440\u0432\u044b\u043c \u0438 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u043c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u043c, \u0441\u0440\u0435\u0434\u043d\u0435\u0435 \u043f\u043e \u0432\u0441\u0435\u043c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f\u043c.'}
];
const kpiLabels = Object.fromEntries(kpiInfo.map(i=>[i.key,i.label]));
const kpiOrder = kpiInfo.map(i=>i.key);


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

  const mediaCount = msgs.filter(m => m.media_type).length;
  const linkCount = msgs.filter(m => /https?:\/\//i.test(extractText(m.text))).length;
  const lengths = msgs.map(m => extractText(m.text).length);
  const wordLengths = msgs.map(m => extractText(m.text).split(/\s+/).filter(Boolean).length);
  const avgChars = avg(lengths).toFixed(1);
  const avgWords = avg(wordLengths).toFixed(1);
  const longMsgs = lengths.filter(l => l > 500).length;
  const emojiFreq = msgs.reduce((acc,m)=>acc+(extractText(m.text).match(/\p{Emoji}/gu)||[]).length,0);
  const forwarded = msgs.filter(m => m.forwarded_from).length;
  const replyMsgs = msgs.filter(m => m.reply_to_message_id).length;
  const mentionCount = msgs.reduce((acc,m)=>acc+(extractText(m.text).match(/@\w+/g)||[]).length,0);
  const questionCount = msgs.filter(m => extractText(m.text).includes('?')).length;

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
  const groups = range==='day' ? groupByDay(filteredMessages)
                : range==='month' ? groupByMonth(filteredMessages)
                : range==='year' ? groupByYear(filteredMessages)
                : groupByMonth(filteredMessages);
  const count = range==='day' ? 30 : (range==='month' ? 12 : Math.min(Object.keys(groups).length,5));
  const periods = Object.keys(groups).sort().slice(-count);
  const stats = periods.map(p=>({p, m:computeMetrics(groups[p])}));
  const container = document.getElementById('metric-range-table');
  if(!container) return;
  let header = '<tr><th>\u041c\u0435\u0442\u0440\u0438\u043a\u0430</th>' + periods.map(p=>`<th>${p}</th>`).join('') + '</tr>';
  let rows = '';
  metricOrder.forEach(key=>{
    rows += `<tr><td>${metricLabels[key]}</td>` + stats.map(s=>`<td>${s.m[key]}</td>`).join('') + '</tr>';
  });
  container.innerHTML = `<table class="period-metrics">${header}${rows}</table>`;
}

function renderMetricChart(){
  const metric = document.getElementById('metric-select').value;
  const range = document.getElementById('metric-chart-range').value;
  const groups = range==='day' ? groupByDay(filteredMessages)
                : range==='month' ? groupByMonth(filteredMessages)
                : range==='year' ? groupByYear(filteredMessages)
                : groupByMonth(filteredMessages);
  const count = range==='day' ? 30 : (range==='month' ? 12 : Math.min(Object.keys(groups).length,5));
  const periods = Object.keys(groups).sort().slice(-count);
  const data = periods.map(p=>computeMetrics(groups[p])[metric]);
  if(charts.metric) charts.metric.destroy();
  charts.metric = new Chart(document.getElementById('metric-chart'),{
    type:'line',
    data:{labels:periods,datasets:[{label:metricLabels[metric],data,fill:false,borderColor:'green'}]},
    options:{scales:{x:{ticks:{autoSkip:false}}}}
  });
}

function renderKpiChart(){
  const metric = document.getElementById('kpi-select').value;
  const range = document.getElementById('kpi-chart-range').value;
  const groups = range==='day' ? groupByDay(filteredMessages)
                : range==='month' ? groupByMonth(filteredMessages)
                : range==='year' ? groupByYear(filteredMessages)
                : groupByMonth(filteredMessages);
  const count = range==='day' ? 30 : (range==='month' ? 12 : Math.min(Object.keys(groups).length,5));
  const periods = Object.keys(groups).sort().slice(-count);
  const data = periods.map(p=>{
    const m=computeMetrics(groups[p]);
    return metric.startsWith('retention.') ? m.retention[metric.split('.')[1]] : m[metric];
  });
  if(charts.kpi) charts.kpi.destroy();
  charts.kpi = new Chart(document.getElementById('kpi-chart'),{
    type:'line',
    data:{labels:periods,datasets:[{label:kpiLabels[metric],data,fill:false,borderColor:'purple'}]},
    options:{scales:{x:{ticks:{autoSkip:false}}}}
  });
}

function drawWords(){
  const stop=['и','в','не','на','я','что','быть','с','он','а','это','как','то','этот','по','к','но','они','мы','она','который','из','у','свой','вы','весь','за','для','от','о','так','мочь','все','ты','—','же','год','один','такой','тот','или','если','только','его','бы','себя','кто','там','мне','вообще','можно','где','еще','уже','будет','этого','есть','себе','было'];
  const pronouns=['я','ты','вы','мы','он','она','оно','они','мой','моя','моё','мои','твой','твоя','твоё','твои','наш','наша','наше','наши','ваш','ваша','ваше','ваши','его','её','их','кто','что','сам','себя'];
  const noun=/(а|я|о|е|ы|и|у|ю|ь|ей|ой|ам|ям|ом|ем|ах|ях)$/;
  const adj=/(ый|ий|ой|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ым|им|ых|их)$/;
  const verb=/(ать|ять|еть|ить|утся|ется|ишь|ешь|ет|ют|ит|ят|ал|ил|ала|ила|али|или)$/;
  const part=/(вший|ющий|емый|енный|ённый|анный|ящий|имый)$/;
  const ger=/(я|в|ши|ючи)$/;
  function allowed(w){
    return noun.test(w)||adj.test(w)||verb.test(w)||part.test(w)||ger.test(w)||pronouns.includes(w);
  }
  const freq={};
  filteredMessages.forEach(m=>{
    const words=extractText(m.text).toLowerCase().match(/[a-zA-Z\u0400-\u04FF]{3,}/g);
    if(!words) return;
    words.forEach(w=>{if(!stop.includes(w)&&allowed(w)) freq[w]=(freq[w]||0)+1;});
  });
  const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  const el=document.getElementById('words');
  el.innerHTML='<h2>\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0435 \u0441\u043b\u043e\u0432\u0430</h2>'+
    '<label>\u0422\u043e\u043f <select id="word-top-select"><option value="10">10</option><option value="30">30</option><option value="50">50</option></select></label><div id="word-table"></div>';
  function render(count){
    const top=sorted.slice(0,count);
    let table='<table class="metric-table"><tr><th>\u0421\u043b\u043e\u0432\u043e</th><th>\u0427\u0430\u0441\u0442\u043e\u0442\u0430</th></tr>';
    top.forEach(([w,c])=>{table+=`<tr><td>${w}</td><td>${c}</td></tr>`;});
    table+='</table>';
    document.getElementById('word-table').innerHTML=table;
  }
  const select=document.getElementById('word-top-select');
  select.addEventListener('change',e=>render(parseInt(e.target.value)));
  render(10);
}
