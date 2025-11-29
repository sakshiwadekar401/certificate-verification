// main.js - User Certificate Verification

const BACKEND_URL = 'http://127.0.0.1:5000/api';

// Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const verifyBtn = document.getElementById('verifyBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultArea = document.getElementById('resultArea');

let selectedFile = null;

// Drag and Drop handlers
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// Click to upload
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle file selection
function handleFileSelect(file) {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    
    if (!validTypes.includes(file.type)) {
        showError('Please upload a valid file (PDF, JPG, or PNG)');
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) { // 16MB
        showError('File size must be less than 16MB');
        return;
    }
    
    selectedFile = file;
    
    // Show file preview
    uploadArea.style.display = 'none';
    filePreview.style.display = 'flex';
    fileName.textContent = file.name;
    verifyBtn.disabled = false;
    
    // Hide previous results
    resultArea.style.display = 'none';
}

// Remove file
removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    
    uploadArea.style.display = 'block';
    filePreview.style.display = 'none';
    verifyBtn.disabled = true;
    resultArea.style.display = 'none';
});

// Verify button click
verifyBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    // Show loading
    verifyBtn.style.display = 'none';
    loadingSpinner.style.display = 'block';
    resultArea.style.display = 'none';
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('certificate_file', selectedFile);
        
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/verify-certificate`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // For now, we'll use verify-by-id approach
            // You can prompt user for certificate ID
            const certId = prompt('Enter Certificate ID to verify:');
            
            if (certId) {
                await verifyById(certId);
            } else {
                showError('Certificate ID is required for verification');
                resetVerifyButton();
            }
        } else {
            showError(data.error || 'Verification failed');
            resetVerifyButton();
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to connect to verification service');
        resetVerifyButton();
    }
});

// Verify by Certificate ID
async function verifyById(certId) {
    try {
        const response = await fetch(`${BACKEND_URL}/verify-by-id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ certificate_id: certId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.verified) {
            showSuccess(data);
        } else {
            showNotVerified(data.message || 'Certificate not found or invalid');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Verification failed');
    } finally {
        resetVerifyButton();
    }
}

// Show success result
function showSuccess(data) {
    resultArea.className = 'result-area success';
    resultArea.innerHTML = `
        <div class="result-icon">
            <i class="fas fa-check-circle"></i>
        </div>
        <h3 class="result-title">✓ Certificate Verified!</h3>
        <p>This certificate is authentic and valid</p>
        <div class="result-details">
            <div class="detail-row">
                <span class="detail-label">Student Name:</span>
                <span class="detail-value">${data.student_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Course:</span>
                <span class="detail-value">${data.course_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Issue Date:</span>
                <span class="detail-value">${data.issue_date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Issuer:</span>
                <span class="detail-value">${data.issuer}</span>
            </div>
        </div>
    `;
    resultArea.style.display = 'block';
}

// Show not verified result
function showNotVerified(message) {
    resultArea.className = 'result-area error';
    resultArea.innerHTML = `
        <div class="result-icon">
            <i class="fas fa-times-circle"></i>
        </div>
        <h3 class="result-title">✗ Certificate Not Verified</h3>
        <p>${message}</p>
    `;
    resultArea.style.display = 'block';
}

// Show error
function showError(message) {
    resultArea.className = 'result-area error';
    resultArea.innerHTML = `
        <div class="result-icon">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 class="result-title">Error</h3>
        <p>${message}</p>
    `;
    resultArea.style.display = 'block';
}

// Reset verify button
function resetVerifyButton() {
    verifyBtn.style.display = 'flex';
    loadingSpinner.style.display = 'none';
}

// Check backend health on load
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = await response.json();
        console.log('Backend status:', data);
    } catch (error) {
        console.error('Backend not reachable:', error);
    }
});