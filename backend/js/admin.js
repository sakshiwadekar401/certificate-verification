// admin.js - Admin Panel Logic

const BACKEND_URL = 'http://127.0.0.1:5000/api';

// Elements
const loginSection = document.getElementById('loginSection');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// Tab elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Issue form elements
const issueCertForm = document.getElementById('issueCertForm');
const fileUploadBox = document.getElementById('fileUploadBox');
const certFileInput = document.getElementById('certFile');
const uploadedFileName = document.getElementById('uploadedFileName');
const issueSuccess = document.getElementById('issueSuccess');
const issueError = document.getElementById('issueError');
const issueLoading = document.getElementById('issueLoading');

// Manage elements
const certificatesList = document.getElementById('certificatesList');
const searchCert = document.getElementById('searchCert');

let authToken = localStorage.getItem('adminToken');
let selectedCertFile = null;

// Check if already logged in
if (authToken) {
    showAdminPanel();
} else {
    loginSection.style.display = 'flex';
}

// Login form submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${BACKEND_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            loginSection.style.display = 'none';
            showAdminPanel();
        } else {
            showLoginError(data.error || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Failed to connect to server');
    }
});

// Show login error
function showLoginError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
    setTimeout(() => {
        loginError.style.display = 'none';
    }, 3000);
}

// Show admin panel
function showAdminPanel() {
    adminPanel.style.display = 'block';
    loadStats();
    loadCertificates();
}

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    authToken = null;
    adminPanel.style.display = 'none';
    loginSection.style.display = 'flex';
    loginForm.reset();
});

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Remove active class from all tabs
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        btn.classList.add('active');
        document.getElementById(`${targetTab}Tab`).classList.add('active');
    });
});

// File upload box click
fileUploadBox.addEventListener('click', () => {
    certFileInput.click();
});

// Handle cert file selection
certFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        selectedCertFile = e.target.files[0];
        uploadedFileName.textContent = `Selected: ${selectedCertFile.name}`;
        uploadedFileName.style.display = 'block';
    }
});

// Issue certificate form submit
issueCertForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    issueSuccess.style.display = 'none';
    issueError.style.display = 'none';
    issueLoading.style.display = 'flex';
    
    const certId = document.getElementById('certId').value;
    const studentName = document.getElementById('studentName').value;
    const courseName = document.getElementById('courseName').value;
    const issueDate = document.getElementById('issueDate').value;
    
    if (!selectedCertFile) {
        showIssueError('Please select a certificate file');
        issueLoading.style.display = 'none';
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('certificate_id', certId);
        formData.append('student_name', studentName);
        formData.append('course_name', courseName);
        formData.append('issue_date', issueDate);
        formData.append('certificate_file', selectedCertFile);
        
        const response = await fetch(`${BACKEND_URL}/admin/issue-certificate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showIssueSuccess(`Certificate issued successfully! IPFS Hash: ${data.ipfs_hash}`);
            issueCertForm.reset();
            selectedCertFile = null;
            uploadedFileName.style.display = 'none';
            loadStats();
            loadCertificates();
        } else {
            showIssueError(data.error || 'Failed to issue certificate');
        }
    } catch (error) {
        console.error('Issue error:', error);
        showIssueError('Failed to connect to server');
    } finally {
        issueLoading.style.display = 'none';
    }
});

// Show issue success
function showIssueSuccess(message) {
    issueSuccess.textContent = message;
    issueSuccess.style.display = 'block';
    setTimeout(() => {
        issueSuccess.style.display = 'none';
    }, 5000);
}

// Show issue error
function showIssueError(message) {
    issueError.textContent = message;
    issueError.style.display = 'block';
    setTimeout(() => {
        issueError.style.display = 'none';
    }, 3000);
}

// Load statistics
async function loadStats() {
    // Mock data for now - you can implement actual API call
    document.getElementById('totalCerts').textContent = '0';
    document.getElementById('validCerts').textContent = '0';
    document.getElementById('revokedCerts').textContent = '0';
}

// Load certificates list
async function loadCertificates() {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/certificates`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        // For now, show no data message
        // You'll need to implement event listening or maintain a list in smart contract
        certificatesList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>No certificates found</p>
                <p style="font-size: 12px; margin-top: 10px;">Issue your first certificate to see it here</p>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load certificates:', error);
    }
}

// Search certificates
searchCert.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    // Implement search filtering here
});

// Revoke certificate
async function revokeCertificate(certId) {
    if (!confirm('Are you sure you want to revoke this certificate?')) {
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/admin/revoke-certificate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ certificate_id: certId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert('Certificate revoked successfully');
            loadCertificates();
            loadStats();
        } else {
            alert(data.error || 'Failed to revoke certificate');
        }
    } catch (error) {
        console.error('Revoke error:', error);
        alert('Failed to connect to server');
    }
}

// Set today's date as default
document.getElementById('issueDate').valueAsDate = new Date();