# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in this project, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email security details to your security team
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

---

## Security Best Practices

### For Developers

#### Environment Variables
- **NEVER** commit `.env` files to version control
- Use `.env.example` as templates with placeholder values
- Rotate secrets regularly (at least every 90 days)
- Use strong, randomly generated secrets (minimum 32 characters)

#### Authentication
- All API endpoints (except public routes) require Firebase Authentication
- Match-engine endpoints require shared secret authentication
- Failed authentication attempts are logged with IP addresses
- Implement rate limiting on authentication endpoints

#### Docker Security
- Containers run with resource limits (CPU, memory, PIDs)
- Security options enabled: `no-new-privileges`
- All capabilities dropped by default
- Privileged mode explicitly disabled
- Read-only root filesystem where applicable

#### Input Validation
- All user inputs must be validated
- Use schema validation for request bodies
- Sanitize inputs to prevent injection attacks
- Limit array sizes in bulk operations

---

## Deployment Security Checklist

### Before Deploying to Production

#### Environment Configuration
- [ ] All `.env` files excluded from version control
- [ ] Production environment variables set in deployment platform
- [ ] `NODE_ENV=production` set
- [ ] Strong secrets generated (32+ characters)
- [ ] Firebase service account key rotated
- [ ] CORS origins set to production domains only (no localhost)
- [ ] Match engine shared secret configured

#### Network Security
- [ ] HTTPS/TLS enabled with valid certificates
- [ ] HSTS headers configured
- [ ] Firewall rules configured
- [ ] Match-engine port (7000) NOT exposed to public
- [ ] Only backend can access match-engine (IP whitelist or network isolation)

#### Application Security
- [ ] Security headers enabled (CSP, X-Frame-Options, etc.)
- [ ] Rate limiting configured
- [ ] Error messages don't expose internal details
- [ ] Logging configured for security events
- [ ] Admin routes protected with role-based access control

#### Docker Security
- [ ] Docker socket access restricted
- [ ] Container resource limits configured
- [ ] Security options enabled
- [ ] Base images from trusted sources
- [ ] Images scanned for vulnerabilities

#### Monitoring & Logging
- [ ] Structured logging enabled
- [ ] Security events logged
- [ ] Log aggregation configured
- [ ] Alerts set up for suspicious activity
- [ ] Health checks configured

---

## Secret Rotation Procedures

### Firebase Service Account Key

1. Generate new service account key in Firebase Console
2. Update `FIREBASE_PRIVATE_KEY` in production environment
3. Deploy updated configuration
4. Verify application works with new key
5. Delete old service account key in Firebase Console
6. Update local `.env` files for development

### Match Engine Shared Secret

1. Generate new strong random secret (32+ characters):
   ```bash
   openssl rand -base64 32
   ```
2. Update `MATCH_ENGINE_SECRET` in both backend and match-engine environments
3. Deploy both services simultaneously
4. Verify backend can communicate with match-engine
5. Monitor logs for authentication errors

---

## Security Monitoring

### What to Monitor

#### Authentication
- Failed login attempts (especially repeated failures from same IP)
- Invalid token submissions
- Authorization failures (users trying to access admin endpoints)

#### Rate Limiting
- Rate limit violations
- Patterns of abuse (same IP hitting limits repeatedly)
- Unusual traffic spikes

#### Docker/Match Engine
- Container creation/deletion patterns
- Resource usage anomalies
- Unauthorized access attempts to match-engine

#### Admin Actions
- All admin actions are logged in audit log
- Monitor for:
  - User bans/unbans
  - Match manipulation
  - System configuration changes
  - Bulk operations

### Alert Thresholds

Set up alerts for:
- More than 10 failed auth attempts from same IP in 5 minutes
- More than 100 rate limit violations in 1 hour
- Any unauthorized access attempts to match-engine
- Error rate above 5%
- Response time above 2 seconds (p95)

---

## Incident Response

### If Security Breach Detected

1. **Contain**: Immediately rotate affected credentials
2. **Assess**: Determine scope of breach
3. **Remediate**: Fix vulnerability
4. **Notify**: Inform affected users if data compromised
5. **Document**: Write post-mortem
6. **Improve**: Update security measures

### Emergency Contacts

- Security Team: [your-security-team@example.com]
- DevOps Team: [your-devops-team@example.com]
- On-call: [your-oncall-rotation]

---

## Compliance

### Data Protection

- User passwords stored via Firebase Authentication (bcrypt)
- Personal data encrypted in transit (HTTPS)
- Firestore security rules prevent direct client access
- All data access goes through authenticated backend

### Audit Logging

- All admin actions logged to `admin_events` collection
- Logs include: timestamp, admin ID, action, target, details
- Logs retained for 90 days minimum
- Security events logged separately

---

## Security Updates

### Dependency Management

- Run `npm audit` regularly
- Update dependencies monthly
- Critical security updates applied within 48 hours
- Test updates in staging before production

### Vulnerability Scanning

- Docker images scanned before deployment
- Code scanned with static analysis tools
- Regular penetration testing (quarterly recommended)

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
