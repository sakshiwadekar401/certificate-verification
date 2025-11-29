// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CertificateVerification {
    
    struct Certificate {
        string studentName;
        string courseName;
        string issueDate;
        string certificateHash;
        bool isValid;
        address issuer;
    }
    
    // Mapping from certificate ID to Certificate
    mapping(string => Certificate) public certificates;
    
    // Mapping to track authorized issuers
    mapping(address => bool) public authorizedIssuers;
    
    address public admin;
    
    event CertificateIssued(
        string certificateId,
        string studentName,
        string courseName,
        address issuer
    );
    
    event CertificateRevoked(string certificateId);
    
    constructor() {
        admin = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Not authorized to issue certificates");
        _;
    }
    
    // Add authorized issuer
    function addIssuer(address _issuer) public onlyAdmin {
        authorizedIssuers[_issuer] = true;
    }
    
    // Remove authorized issuer
    function removeIssuer(address _issuer) public onlyAdmin {
        authorizedIssuers[_issuer] = false;
    }
    
    // Issue a new certificate
    function issueCertificate(
        string memory _certificateId,
        string memory _studentName,
        string memory _courseName,
        string memory _issueDate,
        string memory _certificateHash
    ) public onlyAuthorized {
        require(!certificates[_certificateId].isValid, "Certificate already exists");
        
        certificates[_certificateId] = Certificate({
            studentName: _studentName,
            courseName: _courseName,
            issueDate: _issueDate,
            certificateHash: _certificateHash,
            isValid: true,
            issuer: msg.sender
        });
        
        emit CertificateIssued(_certificateId, _studentName, _courseName, msg.sender);
    }
    
    // Verify a certificate
    function verifyCertificate(string memory _certificateId) 
        public 
        view 
        returns (
            string memory studentName,
            string memory courseName,
            string memory issueDate,
            bool isValid,
            address issuer
        ) 
    {
        Certificate memory cert = certificates[_certificateId];
        return (
            cert.studentName,
            cert.courseName,
            cert.issueDate,
            cert.isValid,
            cert.issuer
        );
    }
    
    // Revoke a certificate
    function revokeCertificate(string memory _certificateId) public onlyAuthorized {
        require(certificates[_certificateId].isValid, "Certificate does not exist or already revoked");
        certificates[_certificateId].isValid = false;
        emit CertificateRevoked(_certificateId);
    }
    
    // Check if certificate exists and is valid
    function isCertificateValid(string memory _certificateId) public view returns (bool) {
        return certificates[_certificateId].isValid;
    }
}
