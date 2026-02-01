
const DB_KEY = 'ew_master_db_v11';
let currentUserRole = 'user';

const NIMCET_CONFIG = {
    'Math': { correct: 12, negative: 3 }, 
    'Reas': { correct: 6, negative: 1.5 }, 
    'Comp': { correct: 6, negative: 1.5 }, 
    'Eng':  { correct: 4, negative: 1 }   
};
const SUBJECTS = ['Math', 'Reas', 'Comp', 'Eng'];
const SUB_NAMES = {'Math':'Mathematics', 'Reas':'Reasoning', 'Comp':'Computer', 'Eng':'English'};
let quizState = {}, quizTimer = null, chartInstance = null, analysisCharts = [];
const OWNER_CODE = "f47860f2ce27befb830adb548967783cb230e273cdc950e7b45896c1ac8f24ba";
const SECTION_LIMITS = { 'Math': 70, 'Reas': 30, 'Combined': 20 };
const SECTION_GROUPS = { 'Math': ['Math'], 'Reas': ['Reas'], 'Combined': ['Comp', 'Eng'] };



// --- AUTHENTICATION ---
function setAuthMode(mode) {
    const userBtn = document.getElementById('btn-user-mode');
    const ownerBtn = document.getElementById('btn-owner-mode');
    const userForm = document.getElementById('user-form');
    const ownerForm = document.getElementById('owner-form');

    if (mode === 'user') {
        userBtn.className = "flex-1 py-3 rounded-xl font-bold transition-all bg-[#4318FF] text-white";
        ownerBtn.className = "flex-1 py-3 rounded-xl font-bold transition-all text-[#A3AED0]";
        userForm.classList.remove('hidden');
        ownerForm.classList.add('hidden');
    } else {
        ownerBtn.className = "flex-1 py-3 rounded-xl font-bold transition-all bg-[#2B3674] text-white";
        userBtn.className = "flex-1 py-3 rounded-xl font-bold transition-all text-[#A3AED0]";
        ownerForm.classList.remove('hidden');
        userForm.classList.add('hidden');
    }
}


// 2. Simple Hash function
async function generateHash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loginAsOwner() {
    const codeInput = document.getElementById('owner-code');
    const code = codeInput.value.trim();

    if (!code) {
        alert("Please enter admin access code!");
        return;
    }

    // Input code ko hash karke stored hash se compare karna
    const hashedInput = await generateHash(code);

    if (hashedInput === OWNER_CODE) { 
        currentUserRole = 'owner';
        document.getElementById('display-user-name').innerText = "Owner Admin";
        document.getElementById('auth-screen').classList.add('hidden');
        applyPermissions();
    } else {
        alert("Access Denied: Invalid Admin Code!");
        codeInput.value = ""; 
    }
}


function loginAsUser() {
    const name = document.getElementById('user-name-input').value;
    if (!name.trim()) return alert("Please enter your name!");
    currentUserRole = 'user';
    document.getElementById('display-user-name').innerText = name;
    document.getElementById('auth-screen').classList.add('hidden');
    applyPermissions();
}


function applyPermissions() {
    const uploadBtn = document.getElementById('global-upload-btn');
    if(uploadBtn) uploadBtn.style.display = (currentUserRole === 'owner') ? 'flex' : 'none';
    switchView('dashboard');
}

function logout() {
    if(!confirm("Logout now?")) return;
    document.getElementById('auth-screen').classList.remove('hidden');
    currentUserRole = 'user';
    switchView('dashboard');
}

// --- UTILS ---
function updateTimerDisplay(id, seconds) {
    const el = document.getElementById(id);
    if (!el) return;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    el.innerText = h > 0 ? 
        `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : 
        `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getDB() { 
    let db = JSON.parse(localStorage.getItem(DB_KEY)||"{\"tests\":[],\"history\":[]}"); 
    if(!db.tests.length) { db=seedDemo(db); saveDB(db); } 
    return db; 
}
function saveDB(d) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }

function seedDemo(db) {
    db.tests.push({id:'f1',title:'NIMCET Full Mock #01',category:'full',time:120,qs:[{sub:'Math', text:'Sample Math Question', options:['A','B','C','D'], correct:0, marks:12, neg:3}],date:new Date()});
    return db;
}

// --- NAVIGATION ---
function switchView(v) {
    document.querySelectorAll('.nav-link').forEach(e => e.classList.remove('active'));
    const navMap = { 'dashboard': 'nav-dashboard', 'daily': 'nav-daily', 'full': 'nav-full', 'section': 'nav-section', 'leaderboard': 'nav-leaderboard' };
    if(navMap[v] && document.getElementById(navMap[v])) document.getElementById(navMap[v]).classList.add('active');

    document.querySelectorAll('[id^="view-"]').forEach(e => e.classList.add('hidden'));
    const targetView = document.getElementById('view-' + v);
    const viewTests = document.getElementById('view-tests');
    
    if (['daily', 'full', 'pyq', 'section'].includes(v)) {
        if(viewTests) { viewTests.classList.remove('hidden'); loadTests(v); }
    } else if(targetView) {
        targetView.classList.remove('hidden');
    }

    if(v === 'dashboard') loadDashboard();
    if(v === 'section') filterSection('Math');
}

function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('closed'); 
    document.getElementById('main-content').classList.toggle('full'); 
}

function viewAnalysisByIndex(index) {
    const db = getDB();
    const resultData = db.history[index];
    if (resultData) {
        showAnalysis(resultData);
    }
}


function loadDashboard() {
    const db = getDB();
    document.getElementById('dash-tests').innerText = db.tests.length;
    document.getElementById('dash-attempts').innerText = db.history.length;
    const avg = db.history.length ? Math.round(db.history.reduce((a,b)=>a+b.score,0)/db.history.length) : 0;
    document.getElementById('dash-avg').innerText = avg;

    const histEl = document.getElementById('dash-history');
    histEl.innerHTML = db.history.slice(0, 5).map((h, index) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3 font-bold text-[#2B3674] text-xs">${h.testTitle}</td>
            <td class="py-3 font-bold text-[#05CD99] text-xs">${h.score}/${h.max}</td>
            <td class="text-right">
                <button class="text-[10px] font-bold text-[#4318FF] bg-indigo-50 px-3 py-1 rounded-lg" 
                        onclick="viewAnalysisByIndex(${index})">
                    Analysis
                </button>
            </td>
        </tr>`).join('') || `<tr><td colspan="3" class="text-center py-4 text-gray-400">No activity.</td></tr>`;

    if(chartInstance) chartInstance.destroy();
    const canvas = document.getElementById('perfChart');
    if(canvas) {
        const ctx = canvas.getContext('2d');
        const rec = db.history.slice(0, 5).reverse();
        chartInstance = new Chart(ctx, { 
            type: 'line', 
            data: { labels: rec.map(r => r.testTitle.substring(0, 8)), datasets: [{ label: 'Score', data: rec.map(r => r.score), borderColor: '#4318FF', backgroundColor: 'rgba(67,24,255,0.1)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: false } }
        });
    }
}

function loadTests(cat) {
    const grid = document.getElementById('tests-grid');
    const db = getDB();
    const tests = db.tests.filter(t => cat === 'section' ? t.category.startsWith('sec_') : t.category === cat);
    grid.innerHTML = tests.map(t => `
        <div class="dashboard-card relative group p-6 hover:shadow-lg transition bg-white rounded-2xl">
            ${currentUserRole === 'owner' ? `
            <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onclick='openAddModal(null,"${t.id}")' class="text-blue-500"><i class="fas fa-edit"></i></button>
                <button onclick="deleteTest('${t.id}','${cat}')" class="text-red-500"><i class="fas fa-trash"></i></button>
            </div>` : ''}
            <h3 class="text-lg font-bold text-[#2B3674] mb-1 line-clamp-1">${t.title}</h3>
            <p class="text-xs text-gray-400 mb-6">${t.qs.length} Qs | ${t.time} Mins</p>
            <button onclick="startQuiz('${t.id}')" class="w-full py-3 rounded-xl border border-[#4318FF] text-[#4318FF] font-bold hover:bg-[#4318FF] hover:text-white transition">Start Practice</button>
        </div>`).join('');
}

// --- TEST BUILDER ---
let currentBuilderMode = 'manual';

function switchBuilderTab(mode) {
    currentBuilderMode = mode;
    document.getElementById('tab-manual').classList.toggle('active', mode === 'manual');
    document.getElementById('tab-json').classList.toggle('active', mode === 'json');
    document.getElementById('mode-manual').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('mode-json').classList.toggle('hidden', mode !== 'json');
}

function handleImg(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 600;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h *= MAX_W / w; w = MAX_W; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                input.dataset.img = canvas.toDataURL('image/jpeg', 0.6);
            };
        };
        reader.readAsDataURL(file);
    }
}

function openAddModal(ctx, tid = null) {
    document.getElementById('modal-add').classList.remove('hidden');
    document.getElementById('dynamic-questions-list').innerHTML = '';
    document.getElementById('json-input').value = '';
    document.getElementById('edit-test-id').value = tid || '';
    switchBuilderTab('manual');

    if (tid) {
        const t = getDB().tests.find(x => x.id === tid);
        document.getElementById('new-title').value = t.title;
        document.getElementById('new-test-time').value = t.time;
        document.getElementById('new-test-cat').value = t.category;
        t.qs.forEach(q => addNewQuestionField(q));
    } else {
        document.getElementById('new-title').value = '';
        document.getElementById('new-test-time').value = 120;
        addNewQuestionField();
    }
}

function closeAddModal() { document.getElementById('modal-add').classList.add('hidden'); }

function addNewQuestionField(data = null) {
    const container = document.getElementById('dynamic-questions-list');
    const qIndex = Date.now() + Math.random();
    const qDiv = document.createElement('div');
    qDiv.className = "bg-white p-6 rounded-3xl border-2 border-[#4318FF]/10 shadow-sm relative mb-4";
    
    qDiv.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <select class="q-sub bg-[#F4F7FE] border-none rounded-xl px-4 py-2 text-sm font-bold">
                <option value="Math" ${data?.sub==='Math'?'selected':''}>Mathematics</option>
                <option value="Comp" ${data?.sub==='Comp'?'selected':''}>Computer</option>
                <option value="Reas" ${data?.sub==='Reas'?'selected':''}>Reasoning</option>
                <option value="Eng" ${data?.sub==='Eng'?'selected':''}>English</option>
            </select>
            <button onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-trash-alt"></i></button>
        </div>
        <textarea class="q-text-input w-full bg-[#F4F7FE] border-none rounded-xl px-4 py-3 text-sm mb-4 h-20 outline-none" placeholder="Enter Question...">${data?.text || ''}</textarea>
        
        <div class="mb-4 bg-gray-50 p-4 rounded-xl border border-dashed text-center">
            <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-widest">Question Photo (Optional)</label>
            <input type="file" onchange="handleImg(this)" class="q-img-input text-xs">
            ${data?.qImg ? `<p class="text-[10px] text-green-500 mt-1 font-bold">Image loaded</p>` : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${[0, 1, 2, 3].map(i => `
                <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div class="flex items-center gap-2 mb-2">
                        <input type="radio" name="correct_${qIndex}" class="q-correct-radio" ${data?.correct === i ? 'checked' : ''} value="${i}">
                        <span class="text-[10px] font-bold text-gray-400 uppercase">Option ${String.fromCharCode(65+i)}</span>
                    </div>
                    <input type="text" class="q-opt-text-input w-full bg-white border-none rounded-lg px-3 py-2 text-sm mb-2 outline-none shadow-sm" placeholder="Text..." value="${data?.options ? data.options[i] : ''}">
                    <input type="file" onchange="handleImg(this)" class="q-opt-img-input text-[10px] w-full">
                </div>
            `).join('')}
        </div>
    `;
    container.appendChild(qDiv);
}

function saveTest() {
    const db = getDB();
    const title = document.getElementById('new-title').value.trim();
    const cat = document.getElementById('new-test-cat').value;
    const time = parseInt(document.getElementById('new-test-time').value) || 120;
    
    if(!title) return alert("Please fill title!");

    let qs = [];
    if(currentBuilderMode === 'manual') {
        const qBlocks = document.querySelectorAll('#dynamic-questions-list > div');
        qs = Array.from(qBlocks).map((block, idx) => {
            const sub = block.querySelector('.q-sub').value;
            const config = NIMCET_CONFIG[sub];
            return {
                sub,
                text: block.querySelector('.q-text-input').value,
                qImg: block.querySelector('.q-img-input').dataset.img || null,
                options: Array.from(block.querySelectorAll('.q-opt-text-input')).map(i => i.value),
                optImgs: Array.from(block.querySelectorAll('.q-opt-img-input')).map(i => i.dataset.img || null),
                correct: parseInt(block.querySelector('.q-correct-radio:checked')?.value || 0),
                marks: config.correct, neg: config.negative
            };
        });
    } else {
        try {
            qs = JSON.parse(document.getElementById('json-input').value).map(q => {
                const config = NIMCET_CONFIG[q.sub || 'Math'];
                return { ...q, marks: config.correct, neg: config.negative };
            });
        } catch(e) { return alert("Invalid JSON!"); }
    }

    // Sort questions by Subject for correct Section grouping
    const subOrder = {'Math': 1, 'Reas': 2, 'Comp': 3, 'Eng': 4};
    qs.sort((a, b) => (subOrder[a.sub] || 99) - (subOrder[b.sub] || 99));
    qs.forEach((q, i) => q.id = i + 1);

    const tid = document.getElementById('edit-test-id').value || 't_'+Date.now();
    const idx = db.tests.findIndex(x => x.id === tid);
    const testData = { id: tid, title, category: cat, qs, time, date: new Date() };
    if (idx !== -1) db.tests[idx] = testData; else db.tests.push(testData);
    
    saveDB(db); closeAddModal(); loadDashboard(); loadTests(cat);
}

function deleteTest(tid, cat) {
    if(!confirm("Are you sure?")) return;
    const db = getDB();
    db.tests = db.tests.filter(t => t.id !== tid);
    saveDB(db); loadDashboard(); loadTests(cat);
}

// --- QUIZ ENGINE ---
function startQuiz(tid) {
    const t = getDB().tests.find(x => x.id === tid);
    if(!t) return;
    quizState = { ...t, answers: {}, idx: 0, timeLeft: t.time * 60, status: {}, startTime: Date.now() };
    
    const SECTION_GROUPS = { 'Math': ['Math'], 'Reas': ['Reas'], 'Combined': ['Comp', 'Eng'] };
    const flatQs = []; const secMap = {}; let cur = 0;
    Object.keys(SECTION_GROUPS).forEach(g => {
        const gQs = t.qs.filter(q => SECTION_GROUPS[g].includes(q.sub));
        if(gQs.length) { secMap[g] = cur; flatQs.push(...gQs); cur += gQs.length; }
    });
    
    quizState.qs = flatQs; 
    quizState.secMap = secMap; 
    quizState.currSec = Object.keys(secMap)[0];
    quizState.secTimeLeft = (quizState.category === 'full' || quizState.category === 'pyq') ? SECTION_LIMITS[quizState.currSec] * 60 : t.time * 60;

    document.getElementById('modal-quiz').classList.remove('hidden');
    document.getElementById('q-title-display').innerText = t.title;
    
    // Fix initial timer label
    updateTimerLabel(quizState.currSec);
    
    renderTabs(); renderQ(); startTimer();
}

function updateTimerLabel(s) {
    const label = document.getElementById('sec-label');
    if(label) {
        if(s==='Math') label.innerText = "Mathematics Section Time";
        else if(s==='Reas') label.innerText = "Reasoning Section Time";
        else label.innerText = "Comp & Eng Time";
    }
}

function startTimer() {
    if(quizTimer) clearInterval(quizTimer);
    quizTimer = setInterval(() => {
        if (quizState.timeLeft > 0) quizState.timeLeft--;
        updateTimerDisplay('q-timer', quizState.timeLeft);
        
        if (quizState.secTimeLeft > 0) {
            quizState.secTimeLeft--;
        } else if (quizState.category === 'full' || quizState.category === 'pyq') {
            handleSectionLock();
        }
        updateTimerDisplay('sec-timer', quizState.secTimeLeft);
        
        if(quizState.timeLeft <= 0) submitQuiz();
    }, 1000);
}

function renderTabs() {
    const names = { 'Math': 'Mathematics', 'Reas': 'Reasoning', 'Combined': 'Computer & English' };
    document.getElementById('q-sections').innerHTML = Object.keys(quizState.secMap).map(s => 
        `<div class="q-tab ${s === quizState.currSec ? 'active' : ''}" onclick="changeSec('${s}')">${names[s] || s}</div>`).join('');
}

function handleSectionLock() {
    const sections = Object.keys(quizState.secMap);
    const curIdx = sections.indexOf(quizState.currSec);
    if(curIdx < sections.length - 1) changeSec(sections[curIdx + 1]);
    else submitQuiz();
}

function changeSec(s) {
    const sections = Object.keys(quizState.secMap);
    const targetIdx = sections.indexOf(s);
    const curIdx = sections.indexOf(quizState.currSec);
    
    if((quizState.category === 'full' || quizState.category === 'pyq') && targetIdx < curIdx) return;
    
    quizState.currSec = s;
    if(quizState.category === 'full' || quizState.category === 'pyq') {
        quizState.secTimeLeft = SECTION_LIMITS[s] * 60;
    }
    quizState.idx = quizState.secMap[s];
    
    updateTimerLabel(s);
    renderTabs(); renderQ();
}

function renderQ() {
    const q = quizState.qs[quizState.idx];
    document.getElementById('pal-sec-name').innerText = SUB_NAMES[q.sub] || q.sub;
    document.getElementById('q-num').innerText = `Question No. ${quizState.idx + 1}`;
    document.getElementById('q-text').innerText = q.text;
    const imgBox = document.getElementById('q-img-box');
    if(q.qImg) { imgBox.classList.remove('hidden'); document.getElementById('q-img-view').src = q.qImg; }
    else imgBox.classList.add('hidden');

    document.getElementById('q-options').innerHTML = q.options.map((o, i) => `
        <div onclick="selOpt(${i})" class="q-opt ${quizState.answers[quizState.idx] === i ? 'selected' : ''}">
            <div class="opt-radio"></div>
            <div class="flex flex-col"><span>${o}</span>
            ${q.optImgs && q.optImgs[i] ? `<img src="${q.optImgs[i]}" class="mt-2 max-h-32 rounded">` : ''}</div>
        </div>`).join('');
    renderPal();
    if(window.MathJax) MathJax.typesetPromise();
}

function selOpt(i) { quizState.answers[quizState.idx] = i; renderQ(); }
function saveNext() { 
    quizState.status[quizState.idx] = (quizState.answers[quizState.idx] !== undefined) ? 'ans' : 'na';
    if(quizState.idx < quizState.qs.length - 1) { quizState.idx++; renderQ(); } 
}
function markReview() { 
    quizState.status[quizState.idx] = (quizState.answers[quizState.idx] !== undefined) ? 'ans-rev' : 'rev';
    if(quizState.idx < quizState.qs.length - 1) { quizState.idx++; renderQ(); } 
}
function clearRes() { delete quizState.answers[quizState.idx]; quizState.status[quizState.idx] = 'na'; renderQ(); }
function jumpQ(i) { quizState.idx = i; renderQ(); }

function renderPal() {
    const start = quizState.secMap[quizState.currSec];
    const sections = Object.keys(quizState.secMap);
    const nextIdx = sections.indexOf(quizState.currSec) + 1;
    const end = (nextIdx < sections.length) ? quizState.secMap[sections[nextIdx]] : quizState.qs.length;

    let h = '';
    for(let i=start; i<end; i++) {
        const s = quizState.status[i];
        let cls = 'bg-white border-gray-300';
        if(s==='ans') cls='st-ans'; else if(s==='na') cls='st-not-ans'; else if(s==='rev') cls='st-rev'; else if(s==='ans-rev') cls='st-ans-rev';
        if(i===quizState.idx) cls += ' st-curr';
        h += `<div onclick="jumpQ(${i})" class="p-btn ${cls}">${i+1}</div>`;
    }
    document.getElementById('pal-grid').innerHTML = h;
}

// --- ANALYSIS LOGIC ---
function submitQuiz() {
    if(quizTimer) clearInterval(quizTimer);
    let s=0, m=0, pos=0, neg=0, cor=0, wrg=0, att=0;
    const timeSpent = Math.floor((Date.now() - quizState.startTime) / 1000);
    const mm = Math.floor(timeSpent / 60);
    const ss = timeSpent % 60;
    
    const details = quizState.qs.map((q, i) => {
        const uAns = quizState.answers[i];
        m += q.marks;
        if(uAns !== undefined) {
            att++;
            if(uAns === q.correct) { s += q.marks; pos += q.marks; cor++; }
            else { s -= q.neg; neg += q.neg; wrg++; }
        }
        return { qIdx: i, userAns: uAns !== undefined ? uAns : null, correct: q.correct, q: q };
    });

    const res = {
        testTitle: quizState.title,
        score: s, max: m, correct: cor, wrong: wrg, attempted: att,
        totalQs: quizState.qs.length,
        posMarks: pos, negMarks: neg,
        timeTaken: `${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`,
        details: details
    };

    const db = getDB();
    db.history.unshift(res);
    saveDB(db);
    document.getElementById('modal-quiz').classList.add('hidden');
    showAnalysis(res);
}

function showAnalysis(res) {
    switchView('analysis');
    window.currentRes = res;
    document.getElementById('an-score').innerText = res.score;
    document.getElementById('an-total-marks').innerText = res.max;
    document.getElementById('an-attempt').innerText = res.attempted;
    document.getElementById('an-total-qs').innerText = res.totalQs;
    document.getElementById('an-time').innerText = res.timeTaken;
    const perc = Math.round((res.score / res.max) * 100) || 0;
    document.getElementById('an-perc').innerText = perc;
    document.getElementById('bar-score').style.width = Math.max(0, perc) + '%';
    document.getElementById('bar-attempt').style.width = Math.round((res.attempted/res.totalQs)*100) + '%';
    document.getElementById('bar-perc').style.width = Math.max(0, perc) + '%';
    document.getElementById('dist-pos').innerText = '+' + res.posMarks;
    document.getElementById('dist-neg').innerText = '-' + res.negMarks;
    
    analysisCharts.forEach(c => c.destroy()); analysisCharts = [];
    const ctxT = document.getElementById('chartTimeAnalysis').getContext('2d');
    analysisCharts.push(new Chart(ctxT, { 
        type: 'doughnut', 
        data: { labels: ['Skipped', 'Correct', 'Wrong'], datasets: [{ data: [res.totalQs - res.attempted, res.correct, res.wrong], backgroundColor: ['#E0E5F2', '#05CD99', '#EE5D50'] }] },
        options: { cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    }));
    filterSol('all');
}

function switchAnalysisTab(tab) {
    document.querySelectorAll('.an-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('an-overall').classList.toggle('hidden', tab !== 'overall');
    document.getElementById('an-solutions').classList.toggle('hidden', tab !== 'solutions');
}

function filterSol(type) {
    const res = window.currentRes;
    const container = document.getElementById('solutions-list');
    container.innerHTML = '';
    document.querySelectorAll('.sol-filter').forEach(b => b.classList.remove('active'));
    res.details.forEach((item, idx) => {
        let status = item.userAns === null ? 'skipped' : (item.userAns === item.correct ? 'correct' : 'wrong');
        if(type !== 'all' && type !== status) return;
        const border = status === 'correct' ? 'border-green-500' : (status === 'wrong' ? 'border-red-500' : 'border-gray-300');
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl border-l-4 ${border} shadow-sm">
                <div class="flex justify-between mb-2"><span class="font-bold text-xs uppercase text-gray-400">Question ${idx+1} (${item.q.sub})</span><span class="text-[10px] font-bold ${status==='correct'?'text-green-500':'text-red-500'} uppercase">${status}</span></div>
                <p class="text-sm font-semibold mb-3">${item.q.text}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    ${item.q.options.map((o, i) => `<div class="p-2 rounded-lg border ${i===item.correct?'bg-green-50 border-green-200 text-green-700':(i===item.userAns?'bg-red-50 border-red-200 text-red-700':'bg-gray-50 border-gray-100')}">${String.fromCharCode(65+i)}. ${o}</div>`).join('')}
                </div>
            </div>`;
    });
}

function filterSection(s) { loadTests(`sec_${s}`); }
function loadLeaderboard() {
    const h = getDB().history;
    document.getElementById('leaderboard-list').innerHTML = `<h2 class="text-xl font-bold mb-6">Leaderboard</h2>` + h.map((u, i) => `<div class="flex justify-between p-4 border-b"><span>#${i+1} ${u.testTitle}</span><span class="font-bold text-[#4318FF]">${u.score} pts</span></div>`).join('') || '<p class="text-center text-gray-400">No records found.</p>';
}

window.onload = () => {
    document.getElementById('auth-screen').classList.remove('hidden');
    getDB();
};
