
const DB_KEY = 'ew_master_db_v11';
const OWNER_CODE = CONFIG.OWNER_HASH;
let growthChart = null; 
let pendingTestId = null

const NIMCET_CONFIG = {
    'Math': { correct: 12, negative: 3 }, 
    'Reas': { correct: 6, negative: 1.5 }, 
    'Comp': { correct: 6, negative: 1.5 }, 
    'Eng':  { correct: 4, negative: 1 }   
};

const SUB_NAMES = {'Math':'Mathematics', 'Reas':'Reasoning', 'Comp':'Computer', 'Eng':'English'};
const SECTION_LIMITS = { 'Math': 70, 'Reas': 30, 'Combined': 20 };
const SECTION_GROUPS = { 'Math': ['Math'], 'Reas': ['Reas'], 'Combined': ['Comp', 'Eng'] };
let quizState = {}, quizTimer = null, chartInstance = null, analysisCharts = []; // Initialization fixed


const firebaseConfig = CONFIG.FIREBASE_CONFIG;


// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth_fb = firebase.auth(); 
const db_fb = firebase.database();


// ==========================================
//  AUTHENTICATION LOGIC (STUDENT & AUTHOR)
// ==========================================

let currentUserRole = 'user';
let currentBuilderMode = 'manual';

// --- AUTHENTICATION ---
async function generateHash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

// Loader dikhane ke liye
function showLoader(msg = "Loading...") {
    const loader = document.getElementById('global-loader');
    const text = document.getElementById('loader-text');
    if (text) text.innerText = msg;
    if (loader) loader.classList.remove('hidden');
}

// Loader chhupane ke liye
function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.add('hidden');
}


function togglePasswordVisibility() {
    const passwordInput = document.getElementById('user-pass-input');
    const eyeIcon = document.getElementById('eye-icon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// AUTHOR LOGIN
async function loginAsOwner() {
    const codeInput = document.getElementById('owner-code');
    const code = codeInput.value.trim();
    if (!code) return alert("Enter admin code!");
    showLoader("Verifying Admin Access...");

    
    try {
        const hashedInput = await generateHash(code);
        
        if (hashedInput === OWNER_CODE) { 
            currentUserRole = 'owner';
            document.getElementById('display-user-name').innerText = "Author Admin";
            document.getElementById('auth-screen').classList.add('hidden');
            showToast("Admin Login Successful", "success"); 
            applyPermissions();
            loadDashboard(); 
        } else {
            showToast("Invalid Admin Code!", "error");
        }
    } catch (error) {
        showToast("Authentication Error", "error");
    } finally {
        hideLoader();
    }

}

// USER/STUDENT LOGIN (Sirf Username + Firebase Sync)
async function loginAsUser() {
    const name = document.getElementById('user-name-input').value.trim();
    const password = document.getElementById('user-pass-input').value.trim();

    if (!name || !password) return showToast("Enter Username & Password", "error");

    showLoader("Verifying Credentials...");
    const virtualEmail = `${name.toLowerCase().replace(/\s/g, '')}@examwarmup.com`;

    try {
        await firebase.auth().signInWithEmailAndPassword(virtualEmail, password);
        hideLoader();
        showToast(`Welcome back, ${name}`, "success");
        proceedToDashboard(name);
    } catch (error) {
        console.error("Auth Error Code:", error.code);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials') {
            handleNewUser(virtualEmail, password, name);
        } else if (error.code === 'auth/wrong-password') {
            showToast("Wrong password! Please try again.", "error");
            hideLoader();
        } else {
            showToast("Error: " + error.message, "error");
            hideLoader();
        }
    }
}

async function handleNewUser(email, pass, originalName) {
    try {
        const newUser = await firebase.auth().createUserWithEmailAndPassword(email, pass);
        await firebase.database().ref('users/' + newUser.user.uid + '/profile').set({
            username: originalName,
            createdAt: new Date().toISOString()
        });
        showToast("New Account Created!", "success");
        proceedToDashboard(originalName);
    } catch (err) {
        if(err.code === 'auth/email-already-in-use') {
            showToast("Username taken or Wrong Password!", "error");
        } else {
            showToast("Password should be at least 6 characters ", "error");
        }
        hideLoader();
    }
}

function proceedToDashboard(name) {
    hideLoader();

    try {
        const nameDisplay = document.getElementById('display-user-name');
        const authScreen = document.getElementById('auth-screen');

        if (nameDisplay) nameDisplay.innerText = name;
        if (authScreen) authScreen.classList.add('hidden');

        if (typeof applyPermissions === "function") {
            applyPermissions();
        }

        if (typeof loadDashboard === "function") {
            loadDashboard();
        }

    } catch (error) {
        console.error("Dashboard transition error:", error);
        showToast("Error loading dashboard, but you are logged in.", "error");
    }
}

// Permissions handling
function applyPermissions() {
    const uploadBtn = document.getElementById('global-upload-btn');
    const allUsersTab = document.getElementById('nav-all-users');

    if (currentUserRole === 'owner') {
        // Owner logic
        if (uploadBtn) {
            uploadBtn.classList.remove('hidden');
            uploadBtn.style.display = 'flex';
        }
        if (allUsersTab) {
            allUsersTab.classList.remove('hidden');
            allUsersTab.style.display = 'block'; 
        }
    } else {
        // Student logic
        if (uploadBtn) {
            uploadBtn.classList.add('hidden');
            uploadBtn.style.display = 'none';
        }
        if (allUsersTab) {
            allUsersTab.classList.add('hidden');
            allUsersTab.style.display = 'none';
        }
    }
    switchView('dashboard');
}



function logout() {
    document.getElementById('auth-screen').classList.remove('hidden');
    currentUserRole = 'user';
    showToast("Logged out successfully")
    switchView('dashboard');
}

// 1. All Users ko load karne ka function
function loadAllRegisteredUsers() {
    const listEl = document.getElementById('all-users-list');
    const countEl = document.getElementById('total-user-count');

    if (!listEl) return;

    // Loader dikhayein
    listEl.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-indigo-500 font-bold">Fetching students...</td></tr>';

    // Firebase 'users' node ko read karein
    db_fb.ref('users').on('value', (snapshot) => {
        let html = '';
        let count = 0;

        snapshot.forEach((userSnap) => {
            const uid = userSnap.key;
            const userData = userSnap.val();
            const profile = userData.profile;

            if (profile) {
                count++;
                // Date formatting
                const joinedDate = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric'
                }) : 'N/A';

                html += `
                <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td class="py-4 pl-2">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[#4318FF] font-bold text-xs">
                                ${profile.username.charAt(0).toUpperCase()}
                            </div>
                            <span class="font-bold text-[#2B3674]">${profile.username}</span>
                        </div>
                    </td>
                    <td class="py-4 text-gray-400 font-mono text-[10px]">${uid}</td>
                    <td class="py-4 text-gray-500 font-medium">${joinedDate}</td>
                    <td class="py-4 text-center">
                        <button onclick="deleteUserPermanently('${uid}', '${profile.username}')" 
                            class="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>`;
            }
        });

        listEl.innerHTML = html || '<tr><td colspan="4" class="text-center py-10 text-gray-400">No students found.</td></tr>';
        if (countEl) countEl.innerText = `${count} Total`;
    });
}

// 2. Permanent Delete Function
async function deleteUserPermanently(uid, name) {
    const isConfirmed = confirm(`⚠ DANGER: Kya aap sach mein "${name}" ko hamesha ke liye delete karna chahte hain? Iska saara test data mita diya jayega.`);
    
    if (isConfirmed) {
        showLoader(`Removing ${name}...`);
        try {
            // Database se user ke saare records remove karein
            await db_fb.ref('users/' + uid).remove();
            await db_fb.ref('results/' + uid).remove();
            await db_fb.ref('status/' + uid).remove();

            showToast(`${name} has been permanently removed.`, "success");
            // List automatically refresh ho jayegi kyunki hum '.on("value")' use kar rahe hain
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Error deleting user: " + error.message, "error");
        } finally {
            hideLoader();
        }
    }
}



async function loadDashboard() {
    const user = auth_fb.currentUser;
    if (!user) return;

    const adminUI = document.getElementById('admin-view-container');
    const studentUI = document.getElementById('student-view-container');

    if (currentUserRole === 'owner') {
        adminUI.classList.remove('hidden');
        studentUI.classList.add('hidden');
        await loadAdminAnalytics(); // Admin logic
    } else {
        adminUI.classList.add('hidden');
        studentUI.classList.remove('hidden');
        // USER LOGIC CALL
        loadStudentDashboardData(user.uid); 
    }
}



// Global Variable for Admin Chart (top of app.js)
let adminTrendChart = null;

// Inside loadAdminAnalytics function:
function updateAdminTrendChart(allResults) {
    const ctx = document.getElementById('adminTrendChart');
    if (!ctx) return;

    // 1. Data Processing: Date wise attempts count karein
    const dateCounts = {};
    allResults.forEach(res => {
        const date = new Date(res.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        dateCounts[date] = (dateCounts[date] || 0) + 1;
    });

    const labels = Object.keys(dateCounts).slice(-7); // Last 7 days
    const dataPoints = Object.values(dateCounts).slice(-7);

    // 2. Purane chart ko destroy karein
    if (adminTrendChart) {
        adminTrendChart.destroy();
    }

    // 3. Naya Chart Create karein
    adminTrendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Global Test Attempts',
                data: dataPoints,
                backgroundColor: '#4318FF',
                borderRadius: 8,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { drawBorder: false, color: '#F4F7FE' } },
                x: { grid: { display: false } }
            }
        }
    });
}




async function loadAdminAnalytics() {
    showLoader("Syncing Admin Data...");
    try {
        const [testsSnap, usersSnap, resultsSnap] = await Promise.all([
            db_fb.ref('tests').once('value'),
            db_fb.ref('users').once('value'),
            db_fb.ref('results').once('value')
        ]);

        let totalAttempts = 0;
        let accuracySum = 0;
        let globalActivityHTML = "";
        let allResultsArray = []; // Chart ke liye array

        if (resultsSnap.exists()) {
            resultsSnap.forEach(userNode => {
                userNode.forEach(resSnap => {
                    const res = resSnap.val();
                    totalAttempts++;
                    allResultsArray.push(res); // Array mein save karein
                    
                    const acc = (res.correct / (res.attempted || 1)) * 100;
                    accuracySum += acc;

                    globalActivityHTML = `
                        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all">
                            <td class="py-3">
                                <p class="text-[11px] font-extrabold text-[#2B3674]">${res.testTitle || 'Untitled Test'}</p>
                                <p class="text-[9px] text-gray-400">${new Date(res.timestamp).toLocaleDateString()}</p>
                            </td>
                            <td class="py-3 text-right">
                                <span class="bg-indigo-50 text-[#4318FF] px-2 py-1 rounded text-[10px] font-bold">${res.score}/${res.max}</span>
                            </td>
                        </tr>` + globalActivityHTML;
                });
            });
        }

        // Stats Update
        document.getElementById('admin-total-tests').innerText = testsSnap.numChildren() || 0;
        document.getElementById('admin-active-users').innerText = usersSnap.numChildren() || 0;
        document.getElementById('admin-total-attempts').innerText = totalAttempts;
        document.getElementById('admin-avg-acc').innerText = totalAttempts > 0 ? Math.round(accuracySum / totalAttempts) + "%" : "0%";
        document.getElementById('admin-recent-global').innerHTML = globalActivityHTML || '<tr><td colspan="2" class="text-center py-4">No data</td></tr>';

        // --- CHART CALL ---
        updateAdminTrendChart(allResultsArray);

    } catch (error) {
        console.error("Chart Error:", error);
    } finally {
        hideLoader();
    }
}





// Student/User dashboard data load karne ka function
function loadStudentDashboardData(userId) {
    if (!userId) return;

    // 1. Total Tests (Global count)
    db_fb.ref('tests').once('value', (snapshot) => {
        const totalTests = snapshot.numChildren() || 0;
        document.getElementById('dash-tests').innerText = totalTests;
    });

    // 2. User Specific Results (Attempts aur Scores)
    // Path: results/UID
    db_fb.ref('results/' + userId).on('value', (snapshot) => {
        const history = [];
        let totalScore = 0;

        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                history.push({ resId: child.key, ...data });
                totalScore += (Number(data.score) || 0);
            });

            const userHistory = history.reverse(); // Latest first
            const totalAttempts = userHistory.length;
            const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

            // UI Update karein
            document.getElementById('dash-attempts').innerText = totalAttempts;
            document.getElementById('dash-avg').innerText = avgScore;

            // Recent Activity table render karein
            renderRecentActivity(userHistory);
            
            // Performance Chart update karein
            updateGrowthChart(userHistory);
        } else {
            // Agar koi data nahi hai toh reset karein
            document.getElementById('dash-attempts').innerText = "0";
            document.getElementById('dash-avg').innerText = "0";
            document.getElementById('dash-history').innerHTML = '<tr><td colspan="3" class="text-center py-10 text-gray-400">No tests attempted yet.</td></tr>';
        }
    });
}







// Is block ko app.js mein kahin bhi bahar rakh dein
auth_fb.onAuthStateChanged((user) => {
    if (user) {
        // Jaise hi login confirm hoga, ye function trigger hoga
        console.log("Login detected:", user.displayName || user.email);
        loadDashboard();
    } else {
        // Agar logout hai toh data saaf kar dein
        resetDashboardUI();
    }
});


function resetDashboardUI() {
    if(document.getElementById('dash-attempts')) document.getElementById('dash-attempts').innerText = '0';
    if(document.getElementById('dash-avg')) document.getElementById('dash-avg').innerText = '0';
    if(document.getElementById('dash-history')) document.getElementById('dash-history').innerHTML = '';
    if(growthChart) {
        growthChart.destroy();
        growthChart = null;
    }
}

// Stats update karne ke liye common helper
function updateStatsUI(data, label) {
    const totalAttempts = data.length;
    const totalScore = data.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

    if(document.getElementById('dash-attempts')) document.getElementById('dash-attempts').innerText = totalAttempts;
    if(document.getElementById('dash-avg')) document.getElementById('dash-avg').innerText = avgScore;
    
    
}

function updateUserPresence(uid, name) {
    const userStatusRef = db_fb.ref('/status/' + uid);

    const isOnline = {
        state: 'online',
        last_changed: firebase.database.ServerValue.TIMESTAMP,
        username: name
    };

    const isOffline = {
        state: 'offline',
        last_changed: firebase.database.ServerValue.TIMESTAMP,
        username: name
    };

    // Jab user disconnect ho (tab band kare), auto offline karde
    db_fb.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() == false) return;
        userStatusRef.onDisconnect().set(isOffline).then(() => {
            userStatusRef.set(isOnline);
        });
    });
}



// 2. DYNAMIC TABLE (Recent Activity)

function renderRecentActivity(history) {
    const histEl = document.getElementById('dash-history');
    if (!histEl) return;

    if (!history || history.length === 0) {
        histEl.innerHTML = `<tr><td colspan="3" class="text-center py-10 text-gray-400">No activity yet. Attempt a test to see results.</td></tr>`;
        return;
    }

    // Map through user-only history
    histEl.innerHTML = history.slice(0, 10).map((h) => {
        const recordId = h.resId || h.id; 
        
        return `
        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all duration-200">
            <td class="py-4 pr-2 font-bold text-[#2B3674] text-xs">
                <div class="flex flex-col">
                    <span>${h.testTitle || 'NIMCET Mock Test'}</span>
                    <span class="text-[9px] text-gray-400 font-normal">${h.timestamp ? new Date(h.timestamp).toLocaleDateString() : ''}</span>
                </div>
            </td>
            <td class="py-4 font-bold text-[#05CD99] text-xs">
                ${h.score || 0}<span class="text-gray-300 font-normal">/${h.max || 0}</span>
            </td>
            <td class="text-right py-4">
                <button onclick="viewHistoryAnalysis('${recordId}')" 
                    class="text-[10px] font-bold text-[#4318FF] bg-indigo-50 px-4 py-2 rounded-xl hover:bg-[#4318FF] hover:text-white transition-all shadow-sm">
                    View My Analysis
                </button>
            </td>
        </tr>`;
    }).join('');
}



function updateGrowthChart(history) {
    const ctx = document.getElementById('perfChart');
    if (!ctx) return;

    // 1. Agar history khali hai toh chart clear karein aur message dikhayein
    if (!history || history.length === 0) {
        if (growthChart) growthChart.destroy();
        return;
    }

    const chartData = [...history].reverse().slice(-10); 
    
    const labels = chartData.map(h => {
        const title = h.testTitle || "Test";
        return title.length > 10 ? title.substring(0, 10) + ".." : title;
    });
    
    const scores = chartData.map(h => h.score || 0);

    // 3. Purane chart ko delete karein (zaroori hai overlap rokne ke liye)
    if (growthChart) {
        growthChart.destroy();
    }

    // 4. Gradient Fill create karein
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(67, 24, 255, 0.2)');   // Darker Indigo top par
    gradient.addColorStop(1, 'rgba(67, 24, 255, 0.01)');  // Transparent bottom par

    // 5. Naya Chart initialize karein
    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Your Score',
                data: scores,
                fill: true,
                backgroundColor: gradient,
                borderColor: '#4318FF',
                borderWidth: 3,
                tension: 0.45, // Curvy lines (Bézier curves)
                pointBackgroundColor: '#fff',
                pointBorderColor: '#4318FF',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#4318FF',
                pointHoverBorderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1B254B',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Score: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        drawBorder: false,
                        color: '#F4F7FE' 
                    },
                    ticks: {
                        color: '#A3AED0',
                        font: { size: 10, weight: '500' },
                        stepSize: 20
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#A3AED0',
                        font: { size: 10, weight: '500' }
                    }
                }
            }
        }
    });
}












// ==========================================
//  TEST PUBLISH LOGIC (FIXED CONFIG ERROR)
// ==========================================
function saveTest() {
    const title = document.getElementById('new-title').value.trim();
    const cat = document.getElementById('new-test-cat').value;
    const time = parseInt(document.getElementById('new-test-time').value) || 120;
    const editId = document.getElementById('edit-test-id').value;

    if(!title) return alert("Please fill title!");
    showLoader("Publishing Test Paper to Cloud...");

    // Helper function taaki subject hamesha NIMCET_CONFIG ki key se match kare
    const getSubKey = (sub) => {
        if (!sub) return 'Math';
        const s = sub.toLowerCase();
        if (s.includes('math')) return 'Math';
        if (s.includes('reas') || s.includes('logic')) return 'Reas';
        if (s.includes('comp')) return 'Comp';
        if (s.includes('eng')) return 'Eng';
        return 'Math'; // Default
    };

    let qs = [];
    if(currentBuilderMode === 'manual') {
        const qBlocks = document.querySelectorAll('#dynamic-questions-list > div');
        qs = Array.from(qBlocks).map((block, idx) => {
            const rawSub = block.querySelector('.q-sub').value;
            const subKey = getSubKey(rawSub);
            const config = NIMCET_CONFIG[subKey]; // Official multiplier yahan se aayega

            return {
                id: idx + 1, 
                sub: subKey,
                text: block.querySelector('.q-text-input').value,
                qImg: block.querySelector('.q-img-input').dataset.img || null,
                options: Array.from(block.querySelectorAll('.q-opt-text-input')).map(i => i.value),
                optImgs: Array.from(block.querySelectorAll('.q-opt-img-input')).map(i => i.dataset.img || null),
                correct: parseInt(block.querySelector('.q-correct-radio:checked')?.value || 0),
                marks: config.correct, // Sahi weightage (12, 6, 4) assign hoga
                neg: config.negative   // Sahi negative marking assign hogi
            };
        });
    } else {
        try {
            const rawJson = document.getElementById('json-input').value.trim();
            qs = JSON.parse(rawJson).map((q, idx) => {
                const subKey = getSubKey(q.sub);
                const config = NIMCET_CONFIG[subKey] || NIMCET_CONFIG['Math'];
                
                return { 
                    ...q, 
                    id: idx + 1, 
                    sub: subKey, 
                    marks: config.correct, 
                    neg: config.negative 
                };
            });
        } catch(e) { 
            hideLoader();
            return alert("JSON Error: " + e.message); 
        }
    }

    const testData = { 
        title, 
        category: cat, 
        qs, 
        time, 
        date: new Date().toISOString(),
        // Card par total marks sahi dikhane ke liye calculation
        totalMarks: qs.reduce((sum, q) => sum + (q.marks || 0), 0)
    };

    const ref = editId ? db_fb.ref('tests/' + editId) : db_fb.ref('tests').push();
    ref.set(testData)
     .then(() => {
        closeAddModal();
        showToast("Test Paper Published Successfully!", "success");
    })
    .catch((error) => {
         console.error(error);
        showToast("Failed to Publish: " + error.message, "error");
    })
    .finally(() => {
        hideLoader();
    });
}





// History ke liye local storage use hota rahega
function getLocalHistory() {
    return JSON.parse(localStorage.getItem(DB_KEY) || "{\"history\":[]}");
}

function saveLocalHistory(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}


function getDB() { 
    let db = JSON.parse(localStorage.getItem(DB_KEY) || "{\"history\":[]}"); 
    if(!db.tests) db.tests = []; 
    return db; 
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




function loadTests(cat) {
    const grid = document.getElementById('tests-grid');
    const user = auth_fb.currentUser;
    if (!grid || !user) return;
    
    grid.innerHTML = '<p class="col-span-3 text-center py-10 font-bold text-[#4318FF]">Syncing with Cloud...</p>';

    // Step 1: Fetch user's history once to get attempted IDs
    db_fb.ref('results/' + user.uid).once('value', (resSnapshot) => {
        const attemptedIds = [];
        resSnapshot.forEach(child => {
            const data = child.val();
            if(data.testId) attemptedIds.push(data.testId);
        });

        // Step 2: Listen for tests and compare IDs
        db_fb.ref('tests').on('value', (snapshot) => {
            const data = snapshot.val();
            let tests = [];
            if (data) {
                tests = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            }

            const filtered = tests.filter(t => {
                if (cat === 'section') return t.category.startsWith('sec_');
                return t.category === cat;
            });
            
            if (filtered.length === 0) {
                grid.innerHTML = '<p class="col-span-3 text-center py-10 text-gray-400">No tests found.</p>';
                return;
            }

            grid.innerHTML = filtered.map(t => {
    const hasAttempted = attemptedIds.includes(t.id);
    const btnText = hasAttempted ? "Re-attempt Test" : "Start Practice";
    const btnStyle = hasAttempted 
        ? "bg-orange-500 text-white border-2 border-orange-500 hover:bg-transparent hover:text-orange-500" 
        : "bg-[#4318FF] text-white border-2 border-[#4318FF] hover:bg-transparent hover:text-[#4318FF]";

    // --- Naya Logic: Total Marks Calculate Karein ---
    const totalMarks = t.qs ? t.qs.reduce((sum, q) => {
    let subject = q.sub || 'Math';
    if (subject === "Mathematics") subject = "Math";
    if (subject === "Reasoning") subject = "Reas";
    if (subject === "Computer") subject = "Comp";
    if (subject === "English") subject = "Eng";
    
    const weight = NIMCET_CONFIG[subject] ? NIMCET_CONFIG[subject].correct : 12; 
    return sum + weight;
}, 0) : 0;

    return `
    <div class="dashboard-card relative group p-6 hover:shadow-lg transition bg-white rounded-2xl border border-gray-100">
        ${currentUserRole === 'owner' ? `
        <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition z-10">
            <button onclick='openAddModal(null,"${t.id}")' class="text-blue-500 p-1"><i class="fas fa-edit"></i></button>
            <button onclick="deleteTest('${t.id}','${cat}')" class="text-red-500 p-1"><i class="fas fa-trash"></i></button>
        </div>` : ''}

        <h3 class="text-lg font-extrabold text-[#2B3674] mb-6 line-clamp-1">${t.title}</h3>
        
        <div class="flex items-center justify-between mb-8 px-1">
            <div class="flex flex-col items-center flex-1">
                <div class="flex items-center gap-1.5 text-gray-400 mb-1">
                    <i class="far fa-question-circle text-[12px]"></i>
                    <span class="text-[14px] font-bold text-[#2B3674]">${t.qs ? t.qs.length : 0}</span>
                </div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Questions</p>
            </div>

            <div class="w-[1px] h-8 bg-gray-100"></div>

            <div class="flex flex-col items-center flex-1">
                <div class="flex items-center gap-1.5 text-indigo-500 mb-1">
                    <i class="fas fa-medal text-[12px]"></i>
                    <span class="text-[14px] font-bold text-[#2B3674]">${totalMarks}</span>
                </div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Marks</p>
            </div>

            <div class="w-[1px] h-8 bg-gray-100"></div>

            <div class="flex flex-col items-center flex-1">
                <div class="flex items-center gap-1.5 text-orange-500 mb-1">
                    <i class="far fa-clock text-[12px]"></i>
                    <span class="text-[14px] font-bold text-[#2B3674]">${t.time}</span>
                </div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Minutes</p>
            </div>
        </div>

        <button onclick="startQuiz('${t.id}')" 
            class="w-full py-3 rounded-xl font-extrabold text-[13px] tracking-wide transition-all active:scale-95 shadow-md ${btnStyle}">
            ${btnText.toUpperCase()}
        </button>
    </div>`;
}).join('');

        });
    });
}





// --- NAVIGATION ---
function switchView(v) {
    // 1. Sidebar Active State Update
    document.querySelectorAll('.nav-link').forEach(e => {
        e.classList.remove('active');
    });
    
    const navMap = { 
        'dashboard': 'nav-dashboard', 
        'daily': 'nav-daily', 
        'full': 'nav-full', 
        'section': 'nav-section', 
        'pyq': 'nav-pyq',
        'leaderboard': 'nav-leaderboard',
        'all-users': 'nav-all-users'
    };
    
    if(navMap[v] && document.getElementById(navMap[v])) {
        document.getElementById(navMap[v]).classList.add('active');
    }

    // 2. Dynamic Breadcrumb & Title Logic
    const pageCrumb = document.getElementById('page-crumb');
    const pageTitle = document.getElementById('page-title');

    // Har view ke liye mapping
    const titleConfig = {
        'dashboard': { crumb: 'Dashboard', title: 'Dashboard Overview' },
        'daily': { crumb: 'Daily Warmup', title: 'Daily Practice Zone' },
        'full': { crumb: 'Full Mocks', title: 'Full Length Mock Tests' },
        'section': { crumb: 'Section Wise', title: 'Subject Specific Practice' },
        'pyq': { crumb: 'PYQ Papers', title: 'Previous Year Question Papers' },
        'leaderboard': { crumb: 'Leaderboard', title: 'Global Rankings' },
        'all-users': { crumb: 'Admin / Students', title: 'Registered Students' }
    };

    // Text update karein
    if (titleConfig[v]) {
        pageCrumb.innerText = titleConfig[v].crumb;
        pageTitle.innerText = titleConfig[v].title;
    }

    // --- FIX STARTS HERE (Hide all views) ---
    const analysisView = document.getElementById('view-analysis');
    if (analysisView) {
        analysisView.classList.add('hidden');
        analysisView.style.display = 'none'; 
    }

    document.querySelectorAll('[id^="view-"]').forEach(e => {
        if (e.id !== 'view-analysis') {
            e.classList.add('hidden');
            e.style.display = 'none';
        }
    });

    // 3. Target View Logic
    if (v === 'all-users') {
        if (currentUserRole === 'owner') {
            loadAllRegisteredUsers();
            // Breadcrumb logic titleConfig se handle ho rahi hai
        } else {
            switchView('dashboard'); 
            return;
        }
    }

    const targetView = document.getElementById('view-' + v);
    const viewTests = document.getElementById('view-tests');

    if (['daily', 'full', 'pyq', 'section'].includes(v)) {
        if(viewTests) { 
            viewTests.classList.remove('hidden'); 
            viewTests.style.display = 'block';
            loadTests(v); 
        }
    } else if(targetView) {
        targetView.classList.remove('hidden');
        targetView.style.display = 'block';
    }

    if(v === 'dashboard') loadDashboard();
    if(v === 'section') filterSection('Math');
}


// Is line ko app.js mein renderRecentActivity ke andar update karein
function renderRecentActivity(history) {
    const histEl = document.getElementById('dash-history');
    if (!histEl) return;

    if (!history || history.length === 0) {
        histEl.innerHTML = `<tr><td colspan="3" class="text-center py-10 text-gray-400">No activity yet. Attempt a test to see results.</td></tr>`;
        return;
    }

    // Latest tests upar dikhane ke liye history ko use karein
    histEl.innerHTML = history.map((h) => {
        // Fallback agar resId missing ho toh Firebase key use karein
        const recordId = h.resId || h.id; 
        
        return `
        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all duration-200">
            <td class="py-4 pr-2 font-bold text-[#2B3674] text-xs">
                <div class="flex flex-col">
                    <span>${h.testTitle || 'NIMCET Mock Test'}</span>
                    <span class="text-[9px] text-gray-400 font-normal">${h.timestamp ? new Date(h.timestamp).toLocaleDateString() : ''}</span>
                </div>
            </td>
            <td class="py-4 font-bold text-[#05CD99] text-xs">
                ${h.score || 0}<span class="text-gray-300 font-normal">/${h.max || 0}</span>
            </td>
            <td class="text-right py-4">
                <button onclick="viewHistoryAnalysis('${recordId}')" 
                    class="text-[10px] font-bold text-[#4318FF] bg-indigo-50 px-4 py-2 rounded-xl hover:bg-[#4318FF] hover:text-white transition-all shadow-sm">
                    Analysis
                </button>
            </td>
        </tr>`;
    }).join('');
}



function updatePerformanceUI(history) {
   
    document.getElementById('dash-attempts').innerText = history.length;
    
    // Average Score calculation
    const avg = history.length ? Math.round(history.reduce((a, b) => a + b.score, 0) / history.length) : 0;
    document.getElementById('dash-avg').innerText = avg;

    // Recent Activity Table update
    const histEl = document.getElementById('dash-history');
    histEl.innerHTML = history.slice(0, 5).map(h => `
        <tr class="border-b">
            <td class="py-3 font-bold text-[#2B3674]">${h.testTitle}</td>
            <td class="py-3 font-bold text-[#05CD99]">${h.score}/${h.max}</td>
            <td class="text-right">
                <button class="text-xs font-bold text-[#4318FF] bg-indigo-50 px-3 py-1 rounded-lg">Analysis</button>
            </td>
        </tr>`).join('');
}




function switchBuilderTab(mode) {
    // 1. Global mode ko update karein
    currentBuilderMode = mode; 
    
    // 2. Tab buttons ki UI update karein
    document.getElementById('tab-manual').classList.toggle('active', mode === 'manual');
    document.getElementById('tab-json').classList.toggle('active', mode === 'json');
    
    // 3. Content sections ko show/hide karein
    document.getElementById('mode-manual').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('mode-json').classList.toggle('hidden', mode !== 'json');
    
    // 4. --- DYNAMIC SYNC LOGIC ---
    if(mode === 'json') {
        const jsonInput = document.getElementById('json-input');
        
        // Manual builder se current questions ka data uthayein
        const qBlocks = document.querySelectorAll('#dynamic-questions-list > div');
        
        if (qBlocks.length > 0) {
            const currentQs = Array.from(qBlocks).map((block, idx) => {
                // Har block se value extract karein
                const options = Array.from(block.querySelectorAll('.q-opt-text-input')).map(i => i.value);
                const optImgs = Array.from(block.querySelectorAll('.q-opt-img-input')).map(i => i.dataset.img || null);
                
                return {
                    id: idx + 1,
                    sub: block.querySelector('.q-sub').value,
                    text: block.querySelector('.q-text-input').value,
                    qImg: block.querySelector('.q-img-input').dataset.img || null,
                    options: options,
                    optImgs: optImgs,
                    correct: parseInt(block.querySelector('.q-correct-radio:checked')?.value || 0)
                };
            });

            // JSON Editor mein stringify karke fill karein
            jsonInput.value = JSON.stringify(currentQs, null, 2);
        }
        
        jsonInput.focus();
    }
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



async function viewHistoryAnalysis(resId) {
    const user = auth_fb.currentUser;
    if (!user || !resId) return showToast("Result ID not found!", "error");

    showLoader("Fetching your analysis...");

    try {
        // Path fix: results/CURRENT_USER_UID/RESULT_ID
        const snapshot = await db_fb.ref(`results/${user.uid}/${resId}`).once('value');
        const resData = snapshot.val();

        if (resData) {
            window.currentRes = resData;
            switchView('analysis'); 
            showAnalysis(resData); 
        } else {
            showToast("Result not found in your account!", "error");
        }
    } catch (error) {
        showToast("Access Denied!", "error");
    } finally {
        hideLoader();
    }
}




function getEstimatedAIR(score) {
    // 5-Year Average Trend: [Score, AIR]
    const data = [
        [1000, 1],   
        [680, 2],   
        [600, 10],  
        [550, 70],   
        [500, 100],  
        [450, 200],  
        [400, 300],  
        [350, 800], 
        [300, 1200], 
        [250, 2000], 
        [200, 5000],
        [150, 8000],
        [100, 10000],
        [0, 55000]  
    ];

    if (score <= 0) return 55000;
    if (score >= 680) return 1;

    for (let i = 0; i < data.length - 1; i++) {
        const [s1, r1] = data[i];
        const [s2, r2] = data[i + 1];

        if (score <= s1 && score >= s2) {
            const rank = r1 + (s1 - score) * (r2 - r1) / (s1 - s2);
            return Math.round(rank);
        }
    }
    return 55000;
}




function saveDB(d) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }







// --- TEST BUILDER ---


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


async function openAddModal(ctx, tid = null) {
    const modal = document.getElementById('modal-add');
    const listContainer = document.getElementById('dynamic-questions-list');
    const titleInput = document.getElementById('new-title');
    const timeInput = document.getElementById('new-test-time');
    const catInput = document.getElementById('new-test-cat');
    const editIdInput = document.getElementById('edit-test-id');
    const jsonInput = document.getElementById('json-input'); // JSON Textarea
    const jumpContainer = document.getElementById('quick-jump-container');

    // 1. UI Reset
    modal.classList.remove('hidden');
    listContainer.innerHTML = '';
    if (jsonInput) jsonInput.value = ''; // Reset pehle karein
    editIdInput.value = tid || ''; 
    switchBuilderTab('manual');

    if (tid) {
        if (jumpContainer) jumpContainer.classList.remove('hidden');
        showLoader("Fetching test from cloud...");
        
        try {
            const snapshot = await db_fb.ref('tests/' + tid).once('value');
            const t = snapshot.val();

            if (t) {
                titleInput.value = t.title || '';
                timeInput.value = t.time || 120;
                catInput.value = t.category || 'full';

                const questions = t.qs || t.questions || [];
                
                // --- FIX: Existing questions ko JSON Area mein load karein ---
                if (jsonInput && questions.length > 0) {
                    jsonInput.value = JSON.stringify(questions, null, 2);
                }

                if (questions.length > 0) {
                    questions.forEach(q => addNewQuestionField(q));
                } else {
                    addNewQuestionField(); 
                }
                showToast("Data Loaded Successfully", "success");
            } else {
                showToast("Test not found!", "error");
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            showToast("Cloud sync failed!", "error");
        } finally {
            hideLoader();
        }
    } else {
        if (jumpContainer) jumpContainer.classList.add('hidden');
        titleInput.value = '';
        timeInput.value = 120;
        addNewQuestionField();
    }
}



// --- NEW: Ye function bhi app.js mein niche add kar dena ---
function scrollToQuestion() {
    const qNum = document.getElementById('jump-q-number').value;
    if (!qNum) return;

    const target = document.getElementById(`q-block-${qNum}`);

    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight effect
        target.style.transition = "all 0.5s ease";
        target.style.transform = "scale(1.02)";
        target.style.boxShadow = "0 0 25px rgba(67, 24, 255, 0.3)";
        target.style.borderColor = "#4318FF";

        setTimeout(() => {
            target.style.transform = "scale(1)";
            target.style.boxShadow = "";
            target.style.borderColor = "";
        }, 2000);
        
        // Number input ko clear karne ke liye (Optional)
        document.getElementById('jump-q-number').value = '';
    } else {
        showToast(`Question ${qNum} nahi mila!`, "error");
    }
}



function closeAddModal() { document.getElementById('modal-add').classList.add('hidden'); }



function addNewQuestionField(data = null) {
    const container = document.getElementById('dynamic-questions-list');
    const qCount = container.children.length + 1; // Current count for display
    const qIndex = Date.now() + Math.random();
    const qDiv = document.createElement('div');

    // ID assign karein jump feature ke liye
    qDiv.id = `q-block-${qCount}`;
    qDiv.className = "bg-white p-6 rounded-3xl border-2 border-[#4318FF]/10 shadow-sm relative mb-6 transition-all duration-500";
    
    qDiv.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
                <div class="bg-[#4318FF] text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-100">
                    Q${qCount}
                </div>

                <select class="q-sub bg-[#F4F7FE] border-none rounded-xl px-4 py-2 text-sm font-bold text-[#2B3674] outline-none">
                    <option value="Math" ${data?.sub==='Math'?'selected':''}>Mathematics</option>
                    <option value="Comp" ${data?.sub==='Comp'?'selected':''}>Computer</option>
                    <option value="Reas" ${data?.sub==='Reas'?'selected':''}>Reasoning</option>
                    <option value="Eng" ${data?.sub==='Eng'?'selected':''}>English</option>
                </select>
            </div>
            
            <button onclick="removeQuestionBlock(this)" class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
        </div>

        <textarea class="q-text-input w-full bg-[#F4F7FE] border-none rounded-2xl px-5 py-4 text-sm mb-4 h-24 outline-none focus:ring-2 focus:ring-[#4318FF]/20 font-medium" placeholder="Enter Question...">${data?.text || ''}</textarea>
        
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


// 2. DELETE FUNCTION ( addNewQuestionField ke bahar rakhein)
function removeQuestionBlock(btn) {
    const container = document.getElementById('dynamic-questions-list');
    
    if (container.children.length <= 1) {
        showToast("at lelast one question in this!", "error");
        return;
    }

    if (confirm("Do you want to remvoe this question?")) {
        const block = btn.closest('.bg-white'); 
        block.classList.add('opacity-0', 'scale-95'); 
        
        setTimeout(() => {
            block.remove();
            reorderQuestionNumbers(); 
            showToast("Question removed", "info");
        }, 300);
    }
}

// 3. REORDER FUNCTION ( addNewQuestionField ke bahar rakhein)
function reorderQuestionNumbers() {
    const blocks = document.querySelectorAll('#dynamic-questions-list > div');
    blocks.forEach((block, idx) => {
        const qNumDiv = block.querySelector('.bg-[#4318FF]');
        if (qNumDiv) {
            qNumDiv.innerText = `Q${idx + 1}`;
        }
        block.id = `q-block-${idx + 1}`;
    });
}




function deleteTest(tid, cat) {
    if(confirm("Cloud se delete karein?")) {
        db_fb.ref('tests/' + tid).remove();
    }
}



document.addEventListener('change', (e) => {
    if (e.target.id === 'instr-agree') {
        const btn = document.getElementById('start-test-final');
        btn.disabled = !e.target.checked;
        btn.classList.toggle('opacity-50', !e.target.checked);
        btn.classList.toggle('cursor-not-allowed', !e.target.checked);
    }
});





// --- QUIZ ENGINE ---

function startQuiz(tid) {
    showLoader("Preparing Instructions...");

    // Firebase se test fetch karo pehle hi
    db_fb.ref('tests/' + tid).once('value', (snapshot) => {
        const t = snapshot.val();
        hideLoader();
        
        if (!t) return alert("Test not found!");

        // Data ko global variable mein save karo taaki confirmStartQuiz mein use ho sake
        pendingTestData = { ...t, id: tid };

        // --- DYNAMIC UPDATES IN MODAL ---
        const rawQs = t.qs || t.questions || [];
        
        // Subject wise counting
        const counts = { Math: 0, Reas: 0, Comp: 0, Eng: 0 };
        rawQs.forEach(q => {
            if (q.sub.includes('Math')) counts.Math++;
            else if (q.sub.includes('Reas')) counts.Reas++;
            else if (q.sub.includes('Comp')) counts.Comp++;
            else if (q.sub.includes('Eng')) counts.Eng++;
        });

        // HTML update karo
        document.getElementById('instr-test-name').innerText = t.title;
        document.getElementById('instr-duration').innerText = `${t.time || 120} Minutes Duration`;
        document.getElementById('instr-math-count').innerText = `${counts.Math} Qs`;
        document.getElementById('instr-reas-count').innerText = `${counts.Reas} Qs`;
        document.getElementById('instr-comp-count').innerText = `${counts.Comp} Qs`;
        document.getElementById('instr-eng-count').innerText = `${counts.Eng} Qs`;

        // Modal dikhao
        const modal = document.getElementById('modal-instructions');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        // Reset Checkbox & Button
        const agreeCheck = document.getElementById('instr-agree');
        const proceedBtn = document.getElementById('start-test-final');
        if(agreeCheck) agreeCheck.checked = false;
        if(proceedBtn) {
            proceedBtn.disabled = true;
            proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

    }).catch(err => {
        hideLoader();
        alert("Failed to load instructions!");
    });
}


function confirmStartQuiz() {
    const t = pendingTestData;
    if (!t) return;

    document.getElementById('modal-instructions').classList.add('hidden');
    document.getElementById('modal-instructions').style.display = 'none';

    const tid = t.id;
    const rawQuestions = t.qs || t.questions || [];

    const SECTION_GROUPS = { 
        'Math': ['Math', 'Mathematics', 'sec_Math'], 
        'Reas': ['Reas', 'Reasoning'], 
        'Combined': ['Comp', 'Eng', 'Computer', 'English'] 
    };
    
    const flatQs = []; 
    const secMap = {}; 
    let cur = 0;
    
    Object.keys(SECTION_GROUPS).forEach(g => {
        const gQs = rawQuestions.filter(q => 
            q.sub && SECTION_GROUPS[g].some(subName => q.sub.includes(subName))
        );
        if(gQs.length > 0) { 
            secMap[g] = cur; 
            flatQs.push(...gQs); 
            cur += gQs.length; 
        }
    });

    const initialSection = Object.keys(secMap)[0] || 'Math';
    
    quizState = { 
        ...t, 
        id: tid, 
        qs: flatQs.length > 0 ? flatQs : rawQuestions,
        secMap: secMap,
        answers: {}, 
        idx: 0, 
        timeLeft: (t.time || 120) * 60, 
        status: {}, 
        startTime: Date.now(),
        currSec: initialSection 
    };

    // Yahan fix: Initial section ko uska allotted time milega
    const isTimedExam = (quizState.category === 'full' || quizState.category === 'pyq');
    const limit = SECTION_LIMITS[initialSection] || 70;
    
    quizState.secTimeLeft = isTimedExam ? (limit * 60) : (t.time || 120) * 60;

    const quizModal = document.getElementById('modal-quiz');
    if (quizModal) {
        quizModal.classList.remove('hidden');
        quizModal.style.display = 'flex'; 
    }
    
    const qRight = document.querySelector('.q-right');
    if(qRight) qRight.classList.remove('hidden');

    updateTimerLabel(initialSection);
    renderTabs(); 
    renderQ(); 
    startTimer();
}




function prevQ() {
    if (quizState.idx > 0) {
        // Current question ka status save karein agar kuch select hai
        if (quizState.status[quizState.idx] === undefined) {
            quizState.status[quizState.idx] = 'na';
        }
        
        quizState.idx--; // Peeche jayein
        renderQ(); // Screen refresh
    }
}




function updateTimerLabel(s) {
    const label = document.getElementById('sec-label');
    if(label) {
        // Case-insensitive aur full name support ke liye conditions
        if(s === 'Math' || s === 'Mathematics') {
            label.innerText = "MATHEMATICS SECTION TIME";
        } else if(s === 'Reas' || s === 'Reasoning') {
            label.innerText = "REASONING SECTION TIME";
        } else if(s === 'Combined' || s === 'Comp' || s === 'Eng') {
            label.innerText = "COMP & ENG SECTION TIME";
        } else {
            label.innerText = "SECTION TIME";
        }
    }
}



function startTimer() {
    if(quizTimer) clearInterval(quizTimer);
    quizTimer = setInterval(() => {
        // 1. Global Exam Timer (Total 2 Hours)
        if (quizState.timeLeft > 0) quizState.timeLeft--;
        updateTimerDisplay('q-timer', quizState.timeLeft);
        
        // 2. Section Specific Timer (70/30/20 Mins)
        if (quizState.secTimeLeft > 0) {
            quizState.secTimeLeft--;
        } else {
            // JAB CURRENT SECTION KA ALLOTTED TIME KHATAM HO JAYE
            const sections = Object.keys(quizState.secMap);
            const currentIndex = sections.indexOf(quizState.currSec);

            if (currentIndex < sections.length - 1) {
                // AGLE SECTION PAR BHEJO
                const nextSection = sections[currentIndex + 1];
                showToast(`Time Up! Auto-switching to ${nextSection}`, "info");
                
                quizState.currSec = nextSection;
                quizState.idx = quizState.secMap[nextSection]; 
                
                // Agle section ka fresh time set karo
                const limit = SECTION_LIMITS[nextSection] || 20;
                quizState.secTimeLeft = limit * 60;

                updateTimerLabel(nextSection);
                renderTabs();
                renderQ();
            } else {
                // AGAR LAST SECTION THA TO SEEDHA SUBMIT
                submitQuiz(true); 
                return;
            }
        }
        updateTimerDisplay('sec-timer', quizState.secTimeLeft);
        
        // Emergency Check: Agar pura exam time khatam ho jaye
        if(quizState.timeLeft <= 0) submitQuiz(true);
    }, 1000);
}




async function downloadAllActivityPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const user = auth_fb.currentUser;
    const studentName = document.getElementById('display-user-name')?.innerText || "Candidate";

    if (!user) return showToast("Please login first!", "error");
    showLoader("Generating Official Ledger...");

    try {
        const snapshot = await db_fb.ref('results/' + user.uid).once('value');
        const data = snapshot.val();
        if (!data) { 
            hideLoader(); 
            return showToast("No activity found!", "info"); 
        }

        const allResults = Object.values(data).reverse();

        // --- 1. BRANDED HEADER ---
        doc.setFillColor(67, 24, 255); 
        doc.rect(0, 0, 297, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("ExamWarmUp", 15, 18); 
        doc.setFontSize(10);
        doc.text("OFFICIAL PERFORMANCE LEDGER", 15, 25);
        doc.text(`Student: ${studentName.toUpperCase()}`, 282, 18, { align: "right" });

        // --- 2. DATA PREPARATION ---
        const tableBody = allResults.map((res, index) => {
            const acc = res.attempted > 0 ? Math.round((res.correct / res.attempted) * 100) : 0;
            const title = (res.testTitle || "").toLowerCase();
            const rawCat = (res.category || "").toLowerCase(); 
            
            let finalCat = "Full Length Mock";

            if (rawCat.includes('pyq') || title.includes('pyq')) {
                finalCat = "PYQ Paper";
            } else if (rawCat.includes('daily') || title.includes('daily') || title.includes('warm')) {
                finalCat = "Daily Warmup";
            } else if (rawCat.includes('sec') || title.includes('sectional') || title.includes('math') || title.includes('reas') || title.includes('comp') || title.includes('eng')) {
                finalCat = "Sectional Test";
            }

            return [
                index + 1,
                res.testTitle || "Test",
                finalCat, 
                res.timestamp ? new Date(res.timestamp).toLocaleDateString('en-GB') : 'N/A',
                res.max || 0,
                res.score || 0,
                res.correct || 0,
                res.wrong || 0,
                `${acc}%`,
                res.timeTaken || "00:01"
            ];
        });

        // --- 3. TABLE GENERATION WITH UPDATED ROW COLORS ---
        doc.autoTable({
            startY: 50,
            head: [['#', 'Test Name', 'Category', 'Date', 'Max', 'Score', 'Cor.', 'Wrng.', 'Acc.', 'Time']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [67, 24, 255], textColor: [255, 255, 255] },
            styles: { fontSize: 9, cellPadding: 3 },
            
            didParseCell: function(data) {
                if (data.section === 'body') {
                    const rowCategory = data.row.cells[2].text[0]; 
                    
                    // Naya Color Logic apply kiya gaya hai
                    if (rowCategory === "Daily Warmup") {
                        data.cell.styles.fillColor = [255, 255, 255]; // Pure White Row
                    } else if (rowCategory === "Full Length Mock") {
                        data.cell.styles.fillColor = [239, 246, 255]; // Light Blue Row (Pehle ye daily ka tha)
                    } else if (rowCategory === "PYQ Paper") {
                        data.cell.styles.fillColor = [240, 253, 244]; // Green Row (Waisa hi rahega)
                    } else if (rowCategory === "Sectional Test") {
                        data.cell.styles.fillColor = [250, 245, 255]; // Light Purple Row
                    }

                    // Score Column (#5) ko bold rakhne ke liye
                    if (data.column.index === 5) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [67, 24, 255];
                    }
                }
            }
        });

        doc.save(`${studentName}_Performance_Report.pdf`);
        hideLoader();
        showToast("PDF Downloaded with new colors!", "success");

    } catch (error) {
        console.error("PDF Error:", error);
        hideLoader();
        showToast("Error generating PDF", "error");
    }
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
    const currentIndex = sections.indexOf(quizState.currSec);
    const targetIndex = sections.indexOf(s);

    // Backward navigation lock (NIMCET Rule)
    if (targetIndex < currentIndex) {
        showToast("Previous sections are locked.", "error");
        return;
    }

    if (quizState.currSec === s) return;

    // UI Change se pehle state update
    quizState.currSec = s;
    quizState.idx = quizState.secMap[s];
    
    // YAHAN FIX HAI: Manual switch par naya time assign karo
    const isTimedExam = (quizState.category === 'full' || quizState.category === 'pyq');
    const limit = SECTION_LIMITS[s] || 20;
    
    quizState.secTimeLeft = isTimedExam ? (limit * 60) : (quizState.time || 120) * 60;

    updateTimerLabel(s);
    renderTabs(); 
    renderQ();
}




function renderQ() {
    if (!quizState.qs || quizState.qs.length === 0) {
        document.getElementById('q-text').innerText = "Technical Error: Questions missing.";
        return;
    }

    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) {
        if (quizState.idx === 0) {
            prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
            prevBtn.disabled = true;
        } else {
            prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            prevBtn.disabled = false;
        }
    }

    const q = quizState.qs[quizState.idx];

    // --- AUTO-DETECTION: UI Sync for Tabs ---
    const sections = Object.keys(quizState.secMap);
    for (let i = 0; i < sections.length; i++) {
        const sectionName = sections[i];
        const startIdx = quizState.secMap[sectionName];
        const nextSecName = sections[i + 1];
        const endIdx = nextSecName ? quizState.secMap[nextSecName] : quizState.qs.length;

        if (quizState.idx >= startIdx && quizState.idx < endIdx) {
            if (quizState.currSec !== sectionName) {
                quizState.currSec = sectionName;
                updateTimerLabel(sectionName);
                renderTabs(); 
            }
            break;
        }
    }

    // Header and Sidebar UI Updates
    const secLabel = document.getElementById('sec-label'); 
    if (secLabel) {
        const names = { 
            'Math': 'MATHEMATICS SECTION TIME', 
            'Reas': 'REASONING SECTION TIME', 
            'Combined': 'COMPUTER & ENGLISH TIME' 
        };
        secLabel.innerText = names[quizState.currSec] || "SECTION TIME";
    }

    document.getElementById('pal-sec-name').innerText = SUB_NAMES[q.sub] || q.sub;
    document.getElementById('q-num').innerText = `Question No. ${quizState.idx + 1}`;
    document.getElementById('q-text').innerText = q.text;
    
    // Handle Images
    const imgBox = document.getElementById('q-img-box');
    if(q.qImg) { 
        imgBox.classList.remove('hidden'); 
        document.getElementById('q-img-view').src = q.qImg; 
    } else {
        imgBox.classList.add('hidden');
    }

    // Render Options
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

function prevQ() {
    if (quizState.idx > 0) {
        if (quizState.status[quizState.idx] === undefined) {
            quizState.status[quizState.idx] = 'na';
        }
        
        // Index peeche le jayein
        quizState.idx--;
        renderQ();
    }
}

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
        let cls = 'p-btn'; 
        if(s==='ans') cls += ' st-ans'; 
        else if(s==='na') cls += ' st-not-ans'; 
        else if(s==='rev') cls += ' st-rev'; 
        else if(s==='ans-rev') cls += ' st-ans-rev';
        else cls += ' border-gray-300 bg-white text-gray-400';
        
        if(i===quizState.idx) cls += ' st-curr';
        h += `<div onclick="jumpQ(${i})" class="${cls}">${i+1}</div>`;
    }
    document.getElementById('pal-grid').innerHTML = h;
}



function showToast(msg, type = 'success') {
    let toast = document.getElementById('custom-toast');
    
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-toast';
        // Top Right positioning classes (Tailwind)
        toast.className = 'fixed top-5 right-5 px-6 py-4 rounded-2xl shadow-2xl z-[999] font-bold transition-all duration-500 transform translate-x-20 opacity-0 flex items-center gap-3 min-w-[250px]';
        document.body.appendChild(toast);
    }
    
    // Background color based on type
    const bgColor = type === 'success' ? 'bg-[#05CD99]' : (type === 'error' ? 'bg-[#EE5D50]' : 'bg-[#4318FF]');
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle');
    
    toast.className = `fixed top-5 right-5 px-6 py-4 rounded-2xl shadow-2xl z-[999] font-bold transition-all duration-500 transform text-white ${bgColor} flex items-center gap-3 min-w-[250px]`;
    
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    
    // Animation: Right se slide hokar aana
    setTimeout(() => {
        toast.classList.remove('translate-x-20', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 10);
    
    // 3 second baad wapas slide back hona
    setTimeout(() => {
        toast.classList.add('translate-x-20', 'opacity-0');
        toast.classList.remove('translate-x-0', 'opacity-100');
    }, 3000);
}






// --- ANALYSIS LOGIC ---
function submitQuiz(isAuto = false) {
    if (!isAuto) {
        const userConfirmed = confirm("Are you sure you want to submit the test?");
        if (!userConfirmed) return;

    showLoader("Calculating Performance...");
    if(quizTimer) clearInterval(quizTimer);

    const user = auth_fb.currentUser;
    if(!user) return alert("Session expired! Please login again.");

    let s = 0, m = 0, pos = 0, neg = 0, cor = 0, wrg = 0, att = 0;

    const timeSpent = Math.floor((Date.now() - quizState.startTime) / 1000);
    const mm = Math.floor(timeSpent / 60);
    const ss = timeSpent % 60;
    
    const details = quizState.qs.map((q, i) => {
        const uAns = quizState.answers[i];
        m += q.marks;
        let status = 'skipped';
        
        if(uAns !== undefined && uAns !== null) {
            att++;
            if(Number(uAns) === Number(q.correct)) { 
                s += q.marks; pos += q.marks; cor++; status = 'correct';
            } else { 
                s -= q.neg; neg += q.neg; wrg++; status = 'wrong';
            }
        }
        return { 
            q: q, 
            userAns: uAns !== undefined ? uAns : null, 
            status: status 
        };
    });
    



    const res = {
        testId: quizState.id,
        category: quizState.category || "full", // <--- YE LINE ADD KAREIN (Taki category save ho)
        testTitle: quizState.title,
        score: s, max: m, correct: cor, wrong: wrg, attempted: att,
        totalQs: quizState.qs.length, posMarks: pos, negMarks: neg,
        timeTaken: `${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`,
        timestamp: new Date().toISOString(),
        details: details 
    };
        

    if (currentUserRole === 'owner') {
        showToast("Admin Mode: Result not saved ", "info");
        document.getElementById('modal-quiz').classList.add('hidden');
        hideLoader();
        showAnalysis(res); 
        return; 
    }


    db_fb.ref('results/' + user.uid).push(res).then(() => {
        document.getElementById('modal-quiz').classList.add('hidden');
        hideLoader();
        showAnalysis(res);
        showToast("Success: Performance Saved!", "success"); 
    }).catch(err => {
        console.error("Firebase Error:", err);
        showToast("Error saving results!", "error");
    });
}
}



function showAnalysis(res) {
    const analysisView = document.getElementById('view-analysis');
    if (analysisView) {
        analysisView.classList.remove('hidden');
        analysisView.style.display = 'block';
    }

    switchView('analysis');
    
    // 1. Existing Logic (Percentage based on Score)
    const perc = Math.round((res.score / res.max) * 100) || 0;
    
    // 2. New Logic (Accuracy based on Attempted Questions)
    // Formula: (Correct Questions / Attempted Questions) * 100
    const accuracy = res.attempted > 0 ? Math.round((res.correct / res.attempted) * 100) : 0;
    
    const rank = getEstimatedAIR(res.score);
    window.currentRes = res;

    // UI Updates - Basic Info
    document.getElementById('an-score').innerText = res.score;
    document.getElementById('an-total-marks').innerText = res.max;
    document.getElementById('an-attempt').innerText = res.attempted;
    document.getElementById('an-total-qs').innerText = res.totalQs;
    document.getElementById('an-time').innerText = res.timeTaken;
    document.getElementById('an-rank').innerText = rank; 
    document.getElementById('an-total-users').innerText = "90,000+"; 

    // Percentage Update (Purana Logic)
    if(document.getElementById('an-perc')) {
        document.getElementById('an-perc').innerText = perc + "%";
    }
    if(document.getElementById('bar-perc')) {
        document.getElementById('bar-perc').style.width = Math.max(0, perc) + '%';
    }

    // Accuracy Update (Naya Logic)
    const accEl = document.getElementById('an-accuracy');
    const accBar = document.getElementById('bar-accuracy');
    if(accEl) accEl.innerText = accuracy;
    if(accBar) accBar.style.width = accuracy + '%';

    // UI Bars for Score & Attempt
    document.getElementById('bar-score').style.width = Math.max(0, perc) + '%';
    document.getElementById('bar-attempt').style.width = Math.round((res.attempted/res.totalQs)*100) + '%';
    
    // Marks Distribution
    document.getElementById('dist-pos').innerText = '+' + res.posMarks;
    document.getElementById('dist-neg').innerText = '-' + res.negMarks;

    // 4. Charts Update
    analysisCharts.forEach(c => c.destroy()); 
    analysisCharts = [];
    const ctxT = document.getElementById('chartTimeAnalysis').getContext('2d');
    analysisCharts.push(new Chart(ctxT, { 
        type: 'doughnut', 
        data: { 
            labels: ['Skipped', 'Correct', 'Wrong'], 
            datasets: [{ 
                data: [res.totalQs - res.attempted, res.correct, res.wrong], 
                backgroundColor: ['#E0E5F2', '#05CD99', '#EE5D50'] 
            }] 
        },
        options: { cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    }));

    filterSol('all');
    
    if(window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise().catch((err) => console.log(err));
    }
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
    if (!res || !res.details) return;

    container.innerHTML = '';
    document.querySelectorAll('.sol-filter').forEach(btn => {
        btn.classList.remove('active', 'bg-[#4318FF]', 'text-white');
        btn.classList.add('bg-white', 'text-gray-500');
    });

    document.querySelectorAll('.sol-filter').forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${type}'`)) {
            btn.classList.add('active', 'bg-[#4318FF]', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-500');
        }
    });
    
    res.details.forEach((item, idx) => {
    if(type !== 'all' && type !== item.status) return;

    const border = item.status === 'correct' ? 'border-green-500' : (item.status === 'wrong' ? 'border-red-500' : 'border-gray-300');
    
    const solText = item.q.sol || ""; 

    container.innerHTML += `
        <div class="bg-white p-6 rounded-xl border-l-4 ${border} shadow-sm mb-4">
            <div class="flex justify-between mb-2">
                <span class="font-bold text-xs uppercase text-gray-400">Question ${idx+1} (${item.q.sub})</span>
                <span class="text-[10px] font-bold ${item.status==='correct'?'text-green-500':'text-red-500'} uppercase">${item.status}</span>
            </div>
            <p class="text-sm font-semibold mb-3">${item.q.text}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                ${item.q.options.map((o, i) => `
                    <div class="p-2 rounded-lg border ${i === item.q.correct ? 'bg-green-50 border-green-200 text-green-700 font-bold' : (i === item.userAns ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100')}">
                        ${String.fromCharCode(65+i)}. ${o}
                    </div>
                `).join('')}
            </div>
            
            ${solText ? `
                <div class="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p class="text-[10px] font-extrabold text-indigo-600 mb-2 uppercase">Solution:</p>
                    <div class="text-sm text-gray-700">${solText}</div>
                </div>
            ` : ''}
        </div>`;
});
    
    if(window.MathJax) MathJax.typesetPromise();
}

function filterSection(s) { loadTests(`sec_${s}`); }

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
    
    // Mobile par sidebar close hone par body scroll lock karne ke liye (Optional)
    if (sidebar.classList.contains('open')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
}

// Sidebar links par click karne par mobile mein sidebar auto-close ho jaye
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });
});


window.onload = () => {
    document.getElementById('auth-screen').classList.remove('hidden');
    getDB();
};
