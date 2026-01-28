# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days

## Security Considerations

### RPC Security

This tool manages a Radiant node with RPC access. **Critical security considerations:**

1. **Change Default Password:** NEVER use default RPC credentials in production
2. **Network Exposure:** Do NOT expose RPC port to the internet
3. **Firewall Rules:** Configure firewall to allow only trusted IPs
4. **HTTPS:** Use HTTPS for the frontend in production

### Docker Security

1. **Volume Permissions:** Ensure proper permissions on mounted volumes
2. **Network Isolation:** Use Docker networks to isolate components
3. **Resource Limits:** Set memory and CPU limits for containers

### Configuration

Required security settings in `.env`:

```bash
# CHANGE THESE IN PRODUCTION
RPC_USER=your_secure_username
RPC_PASSWORD=your_very_secure_password

# Bind to localhost only
RPC_BIND=127.0.0.1

# Enable SSL for production
SSL_ENABLED=true
```

### Known Limitations

1. **No Authentication:** Frontend has no built-in authentication
2. **LocalStorage:** Some data stored in browser localStorage
3. **Docker Exposure:** Misconfigured Docker can expose ports

### Recommended Setup

For production:
1. Run behind a reverse proxy (nginx/traefik) with SSL
2. Add authentication at the proxy level
3. Use VPN or SSH tunnel for remote access
4. Regular security updates

---

*Last updated: January 2026*
