from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from web3 import Web3
import json
import os
import hashlib
import requests
from dotenv import load_dotenv
import jwt
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create uploads folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Web3 setup
GANACHE_URL = os.getenv('GANACHE_URL', 'http://127.0.0.1:7545')
w3 = Web3(Web3.HTTPProvider(GANACHE_URL))

# Contract setup
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')
with open('../build/contracts/CertificateVerification.json') as f:
    contract_json = json.load(f)
    CONTRACT_ABI = contract_json['abi']

contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

# Pinata configuration
PINATA_API_KEY = os.getenv('PINATA_API_KEY')
PINATA_SECRET_KEY = os.getenv('PINATA_SECRET_KEY')
PINATA_BASE_URL = 'https://api.pinata.cloud'

# Admin credentials (you should change these!)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"  # Change this in production!

# Helper function: Calculate file hash
def calculate_file_hash(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

# Helper function: Upload to Pinata
def upload_to_pinata(file_path, filename):
    url = f"{PINATA_BASE_URL}/pinning/pinFileToIPFS"
    
    headers = {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY
    }
    
    with open(file_path, 'rb') as file:
        files = {'file': (filename, file)}
        response = requests.post(url, files=files, headers=headers)
    
    if response.status_code == 200:
        return response.json()['IpfsHash']
    else:
        raise Exception(f"Pinata upload failed: {response.text}")

# JWT token decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            token = token.split()[1]  # Remove 'Bearer ' prefix
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except:
            return jsonify({'error': 'Token is invalid'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

# Serve Frontend Files
@app.route('/')
def serve_index():
    """Serve the main index.html page"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve all other static files"""
    return send_from_directory(app.static_folder, path)

# API Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    """Check if backend is running"""
    return jsonify({
        'status': 'ok',
        'blockchain_connected': w3.is_connected(),
        'contract_address': CONTRACT_ADDRESS
    })

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Admin login endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # DEBUG: Print what we received
    print("=" * 50)
    print("LOGIN ATTEMPT:")
    print(f"Received username: '{username}'")
    print(f"Received password: '{password}'")
    print(f"Expected username: '{ADMIN_USERNAME}'")
    print(f"Expected password: '{ADMIN_PASSWORD}'")
    print(f"Username match: {username == ADMIN_USERNAME}")
    print(f"Password match: {password == ADMIN_PASSWORD}")
    print("=" * 50)
    
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = jwt.encode({
            'user': username,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            'success': True,
            'token': token,
            'message': 'Login successful'
        })
    
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

@app.route('/api/admin/issue-certificate', methods=['POST'])
@token_required
def issue_certificate():
    """Issue a new certificate (Admin only)"""
    try:
        # Get form data
        certificate_id = request.form.get('certificate_id')
        student_name = request.form.get('student_name')
        course_name = request.form.get('course_name')
        issue_date = request.form.get('issue_date')
        file = request.files.get('certificate_file')
        
        if not all([certificate_id, student_name, course_name, issue_date, file]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Calculate file hash
        file_hash = calculate_file_hash(file_path)
        
        # Upload to Pinata
        ipfs_hash = upload_to_pinata(file_path, filename)
        
        # Get admin account
        admin_account = w3.eth.accounts[0]
        
        # Issue certificate on blockchain
        tx_hash = contract.functions.issueCertificate(
            certificate_id,
            student_name,
            course_name,
            issue_date,
            file_hash
        ).transact({'from': admin_account})
        
        # Wait for transaction receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Clean up temporary file
        os.remove(file_path)
        
        return jsonify({
            'success': True,
            'certificate_id': certificate_id,
            'file_hash': file_hash,
            'ipfs_hash': ipfs_hash,
            'ipfs_url': f'https://gateway.pinata.cloud/ipfs/{ipfs_hash}',
            'transaction_hash': receipt['transactionHash'].hex()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-certificate', methods=['POST'])
def verify_certificate():
    """Verify a certificate (Public endpoint)"""
    try:
        file = request.files.get('certificate_file')
        
        if not file:
            return jsonify({'error': 'No file provided'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Calculate file hash
        file_hash = calculate_file_hash(file_path)
        
        # Search blockchain for this hash
        # We'll need to iterate through certificates or use certificate_id
        # For now, let's check if we can find it by searching recent events
        
        # Clean up
        os.remove(file_path)
        
        # Try to find certificate by hash (you may need to modify this based on your needs)
        # For now, returning basic structure
        return jsonify({
            'file_hash': file_hash,
            'verified': False,  # You'll need to implement the verification logic
            'message': 'Certificate verification endpoint - needs certificate ID'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-by-id', methods=['POST'])
def verify_by_id():
    """Verify certificate by ID"""
    try:
        data = request.json
        certificate_id = data.get('certificate_id')
        
        if not certificate_id:
            return jsonify({'error': 'Certificate ID is required'}), 400
        
        # Check certificate on blockchain
        cert_data = contract.functions.verifyCertificate(certificate_id).call()
        
        if cert_data[3]:  # isValid
            return jsonify({
                'verified': True,
                'student_name': cert_data[0],
                'course_name': cert_data[1],
                'issue_date': cert_data[2],
                'issuer': cert_data[4]
            })
        else:
            return jsonify({
                'verified': False,
                'message': 'Certificate not found or has been revoked'
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/revoke-certificate', methods=['POST'])
@token_required
def revoke_certificate():
    """Revoke a certificate (Admin only)"""
    try:
        data = request.json
        certificate_id = data.get('certificate_id')
        
        if not certificate_id:
            return jsonify({'error': 'Certificate ID is required'}), 400
        
        # Get admin account
        admin_account = w3.eth.accounts[0]
        
        # Revoke certificate
        tx_hash = contract.functions.revokeCertificate(
            certificate_id
        ).transact({'from': admin_account})
        
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return jsonify({
            'success': True,
            'message': 'Certificate revoked successfully',
            'transaction_hash': receipt['transactionHash'].hex()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/certificates', methods=['GET'])
@token_required
def get_all_certificates():
    """Get all certificates (Admin only)"""
    # This would require events or maintaining a list
    # For now, return placeholder
    return jsonify({
        'certificates': [],
        'message': 'Certificate listing - needs event implementation'
    })

if __name__ == '__main__':
    print("=" * 60)
    print("Certificate Verification System Starting...")
    print("=" * 60)
    print(f"Contract Address: {CONTRACT_ADDRESS}")
    print(f"Blockchain Connected: {w3.is_connected()}")
    print(f"Available Accounts: {len(w3.eth.accounts)}")
    print("=" * 60)
    print("Server running at: http://127.0.0.1:5000")
    print("Main page: http://127.0.0.1:5000/")
    print("Admin page: http://127.0.0.1:5000/admin.html")
    print("=" * 60)
    app.run(debug=True, port=5000, host='0.0.0.0')