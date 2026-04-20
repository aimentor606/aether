# OpenSandbox Server Deployment Guide

Complete guide for deploying OpenSandbox Server locally with Docker, integrated with existing infrastructure.

**Repository:** https://github.com/alibaba/OpenSandbox  
**Documentation:** https://open-sandbox.ai/  
**Tested Commit:** `8f7d0908869e2d3d10b5e7104fc4763390a9f8ad`

---

## Quick Start

### Minimum Requirements

- **Docker:** 20.10+ (for clone3 syscall support)
- **Port:** 8080 (configurable)
- **Volume:** `/var/run/docker.sock` must be mounted
- **Images Required:**
  - `opensandbox/server:latest`
  - `opensandbox/execd:v1.0.10`
  - `opensandbox/egress:v1.0.6` (if using networkPolicy)

### 1. Create Configuration File

Create `config/opensandbox.toml`:

```toml
[server]
host = "0.0.0.0"
port = 8080
log_level = "INFO"
# api_key = ""  # Optional: leave empty for dev (no auth)

[runtime]
type = "docker"
execd_image = "opensandbox/execd:v1.0.10"

[docker]
network_mode = "bridge"
host_ip = "host.docker.internal"  # Required when server runs in container
drop_capabilities = [
    "AUDIT_WRITE",
    "MKNOD",
    "NET_ADMIN",
    "NET_RAW",
    "SYS_CHROOT",
    "SETFCAP",
    "SYS_ADMIN",
    "SYS_MODULE",
    "SYS_PTRACE"
]
no_new_privileges = true
pids_limit = 4096  # CRITICAL for multi-sandbox environments

[egress]
image = "opensandbox/egress:v1.0.6"
mode = "dns"

[ingress]
mode = "direct"  # Direct mode for Docker runtime
```

**Critical Configuration Notes:**
- `pids_limit = 4096`: Prevents "can't start new thread" errors in multi-sandbox scenarios
- `host_ip = "host.docker.internal"`: Required when server runs in Docker container with bridge networking
- `network_mode = "bridge"`: Recommended for isolation (use "host" only for single-instance deployments)

### 2. Docker Compose Setup

#### Standalone Deployment

Create `docker-compose.opensandbox.yml`:

```yaml
version: '3.8'

services:
  opensandbox-server:
    image: opensandbox/server:latest
    container_name: opensandbox-server
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./config/opensandbox.toml:/etc/opensandbox/config.toml:ro
    environment:
      - SANDBOX_CONFIG_PATH=/etc/opensandbox/config.toml
      # - EXECD_CLONE3_COMPAT=1  # Uncomment if glibc ≥ 2.34 on Docker < 20.10.10
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

Start the server:

```bash
docker-compose -f docker-compose.opensandbox.yml up -d
```

#### Integration with Existing Infrastructure

Add to your existing `docker-compose.yml`:

```yaml
services:
  # ... your existing services (aether, etc.) ...

  opensandbox-server:
    image: opensandbox/server:latest
    container_name: opensandbox-server
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./config/opensandbox.toml:/etc/opensandbox/config.toml:ro
    environment:
      - SANDBOX_CONFIG_PATH=/etc/opensandbox/config.toml
    restart: unless-stopped
    networks:
      - your-existing-network  # Use your existing network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### 3. Verify Deployment

**Check server health:**

```bash
curl http://localhost:8080/health
# Expected: {"status":"healthy"}
```

**View API documentation:**

```bash
open http://localhost:8080/docs  # Swagger UI
```

**Check logs:**

```bash
docker logs opensandbox-server
```

### 4. Test Sandbox Creation

Install Python SDK:

```bash
pip install opensandbox
```

Create test script `test_sandbox.py`:

```python
import asyncio
from opensandbox import Sandbox
from datetime import timedelta

async def test_sandbox():
    # Create sandbox
    sandbox = await Sandbox.create(
        "opensandbox/code-interpreter:v1.0.2",
        entrypoint=["/opt/opensandbox/code-interpreter.sh"],
        env={"PYTHON_VERSION": "3.11"},
        timeout=timedelta(minutes=10),
        api_key="",  # Empty if no auth configured
    )
    
    print(f"✅ Sandbox created: {sandbox.sandbox_id}")
    
    # Execute code
    result = await sandbox.run_code(
        "python",
        "print('Hello from OpenSandbox!')"
    )
    print(f"📤 Output: {result.text}")
    
    # Cleanup
    await sandbox.close()
    print("🧹 Sandbox closed")

if __name__ == "__main__":
    asyncio.run(test_sandbox())
```

Run test:

```bash
python test_sandbox.py
```

Expected output:
```
✅ Sandbox created: <sandbox-id>
📤 Output: Hello from OpenSandbox!
🧹 Sandbox closed
```

---

## Architecture Overview

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Client (SDK / API)                                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenSandbox Server (FastAPI)                                │
│  - Lifecycle management                                      │
│  - Container orchestration                                   │
│  - execd injection                                           │
└────────────────────────┬────────────────────────────────────┘
                         │ Docker API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Docker Runtime                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  User Container (e.g., code-interpreter)             │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  execd daemon (port 44772)                     │  │  │
│  │  │  - Code execution                              │  │  │
│  │  │  - File operations                             │  │  │
│  │  │  - Process management                          │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Jupyter Server (port 54321)                   │  │  │
│  │  │  - Kernel management                           │  │  │
│  │  │  - Interactive execution                       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  User Entrypoint                               │  │  │
│  │  │  (original container process)                  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### execd Injection Process

When a sandbox is created, the server:

1. **Pulls execd image** (`opensandbox/execd:v1.0.10`)
2. **Extracts execd binary** from image to temporary location
3. **Volume mounts** into target container:
   - `/opt/opensandbox/execd` (binary)
   - `/opt/opensandbox/start.sh` (startup script)
4. **Overrides entrypoint** to `/opt/opensandbox/start.sh`

**Startup sequence inside sandbox:**

```bash
/opt/opensandbox/start.sh
  ↓
  ├─ Start Jupyter Server on port 54321
  │  jupyter notebook --port=54321 --no-browser --ip=0.0.0.0
  │
  ├─ Start execd daemon on port 44772
  │  /opt/opensandbox/execd --jupyter-host=http://127.0.0.1:54321 --port=44772
  │
  └─ Execute user's original entrypoint
     exec "${USER_ENTRYPOINT[@]}"
```

### Supported Base Images

OpenSandbox works with **any Docker image**. Pre-built examples:

- `opensandbox/code-interpreter:v1.0.2` - Python execution environment
- `opensandbox/chrome:v1.0.0` - Chrome browser automation
- `opensandbox/playwright:v1.0.0` - Playwright testing
- `opensandbox/desktop:v1.0.0` - VNC desktop environment
- `opensandbox/vscode:v1.0.0` - VS Code server

**Custom images:** Just use any base image and specify entrypoint when creating sandbox.

---

## Configuration Reference

### TOML Configuration Structure

Full configuration template at: `server/opensandbox_server/examples/example.config.toml`

#### [server] - Server Settings

```toml
[server]
host = "0.0.0.0"        # Listen address (0.0.0.0 = all interfaces)
port = 8080             # Server port
log_level = "INFO"      # Logging: DEBUG, INFO, WARNING, ERROR
api_key = ""            # API key for authentication (empty = no auth)
```

**Authentication:**
- If `api_key` is set, clients must include header: `OPEN-SANDBOX-API-KEY: <api_key>`
- If empty, authentication is disabled (development mode only)

#### [runtime] - Runtime Configuration

```toml
[runtime]
type = "docker"  # Runtime type: "docker" or "kubernetes"
execd_image = "opensandbox/execd:v1.0.10"  # REQUIRED
```

#### [docker] - Docker Runtime Settings

```toml
[docker]
network_mode = "bridge"         # "bridge" or "host"
host_ip = "host.docker.internal"  # Host IP for bridge mode
pids_limit = 4096               # CRITICAL: Max PIDs per sandbox

# Security: Drop unnecessary capabilities
drop_capabilities = [
    "AUDIT_WRITE", "MKNOD", "NET_ADMIN", "NET_RAW",
    "SYS_CHROOT", "SETFCAP", "SYS_ADMIN", "SYS_MODULE", "SYS_PTRACE"
]

no_new_privileges = true  # Prevent privilege escalation

# Optional: Custom seccomp profile
# seccomp_profile = "/path/to/seccomp.json"
```

**Network Modes:**
- `bridge` (recommended): Isolated networks per sandbox, better security
  - Requires `host_ip = "host.docker.internal"` when server in container
- `host`: Share host network stack, lower latency (single instance only)

**pids_limit:**
- Default: 4096 (MUST be set for production)
- Prevents resource exhaustion from fork bombs
- Too low → "can't start new thread" errors

#### [egress] - Network Policy Enforcement

```toml
[egress]
image = "opensandbox/egress:v1.0.6"  # REQUIRED if using networkPolicy
mode = "dns"  # DNS-based filtering
```

Used when creating sandboxes with `networkPolicy` parameter.

#### [ingress] - Traffic Routing

```toml
[ingress]
mode = "direct"  # "direct" for Docker, "gateway" for Kubernetes
```

---

## API Reference

### Health Check

**Endpoint:** `GET /health`

```bash
curl http://localhost:8080/health
```

**Response:**
```json
{"status": "healthy"}
```

### Create Sandbox (REST)

**Endpoint:** `POST /sandbox`

```bash
curl -X POST http://localhost:8080/sandbox \
  -H "Content-Type: application/json" \
  -d '{
    "image": "opensandbox/code-interpreter:v1.0.2",
    "entrypoint": ["/opt/opensandbox/code-interpreter.sh"],
    "env": {"PYTHON_VERSION": "3.11"},
    "timeout": 600
  }'
```

**Response:**
```json
{
  "sandbox_id": "abc123...",
  "status": "running",
  "ports": {"44772": 12345}
}
```

### SDK Usage (Python)

```python
from opensandbox import Sandbox
from datetime import timedelta

# Create sandbox
sandbox = await Sandbox.create(
    "opensandbox/code-interpreter:v1.0.2",
    entrypoint=["/opt/opensandbox/code-interpreter.sh"],
    env={"PYTHON_VERSION": "3.11"},
    timeout=timedelta(minutes=10),
    api_key="",  # If server.api_key is set
    # api_url="http://localhost:8080"  # Default
)

# Execute code
result = await sandbox.run_code("python", "print('Hello')")
print(result.text)  # Output: Hello

# File operations
await sandbox.upload_file("data.csv", b"col1,col2\n1,2")
content = await sandbox.download_file("data.csv")

# Cleanup
await sandbox.close()
```

**SDK Configuration:**
```python
# Custom server URL
Sandbox.configure(api_url="http://opensandbox-server:8080")

# With authentication
sandbox = await Sandbox.create(
    "image:tag",
    api_key="your-secret-api-key"
)
```

---

## Troubleshooting

### Common Issues

#### 1. "Can't start new thread" error

**Symptom:** Sandboxes fail with thread creation errors

**Solution:** Increase `pids_limit` in TOML config:

```toml
[docker]
pids_limit = 4096  # Or higher
```

#### 2. Network connectivity issues from sandbox

**Symptom:** Sandboxes can't reach host services

**Solution:** Set `host_ip` correctly in TOML:

```toml
[docker]
network_mode = "bridge"
host_ip = "host.docker.internal"  # When server runs in Docker
# host_ip = "172.17.0.1"  # When server runs on host
```

#### 3. execd injection fails

**Symptom:** Sandboxes start but execd daemon not running

**Solution:** Check Docker version and enable clone3 compat if needed:

```yaml
environment:
  - EXECD_CLONE3_COMPAT=1  # For glibc ≥ 2.34 on Docker < 20.10.10
```

#### 4. Permission denied on Docker socket

**Symptom:** "permission denied while trying to connect to Docker daemon"

**Solution:** Ensure socket is properly mounted and accessible:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

On macOS/Linux, check permissions:
```bash
ls -l /var/run/docker.sock
# Should be readable by container user
```

#### 5. API authentication errors

**Symptom:** 401 Unauthorized responses

**Solution:** Check API key configuration:

```toml
[server]
api_key = "your-secret-key"  # Must match client header
```

Client must include header:
```python
# SDK
sandbox = await Sandbox.create("image", api_key="your-secret-key")

# curl
curl -H "OPEN-SANDBOX-API-KEY: your-secret-key" http://localhost:8080/health
```

#### 6. Port conflicts

**Symptom:** Server fails to start with "address already in use"

**Solution:** Change server port:

```toml
[server]
port = 8081  # Use different port
```

Update docker-compose.yml:
```yaml
ports:
  - "8081:8081"
```

### Debug Logging

Enable debug logs:

```toml
[server]
log_level = "DEBUG"
```

View real-time logs:

```bash
docker logs -f opensandbox-server
```

### Verify Docker Version

```bash
docker version
# Client and Server versions should be 20.10+
```

### Check Running Sandboxes

```bash
# List all sandbox containers
docker ps -a --filter "label=opensandbox.sandbox_id"

# Inspect specific sandbox
docker inspect <sandbox_id>
```

---

## Security Considerations

### Production Hardening

1. **Enable API Authentication:**
   ```toml
   [server]
   api_key = "generate-strong-random-key"
   ```

2. **Restrict Capabilities:**
   ```toml
   [docker]
   drop_capabilities = [
       "AUDIT_WRITE", "MKNOD", "NET_ADMIN", "NET_RAW",
       "SYS_CHROOT", "SETFCAP", "SYS_ADMIN", "SYS_MODULE", "SYS_PTRACE"
   ]
   no_new_privileges = true
   ```

3. **Set Resource Limits:**
   ```toml
   [docker]
   pids_limit = 4096
   # Optional: Add memory/CPU limits in docker-compose.yml
   ```

4. **Use Bridge Networking:**
   ```toml
   [docker]
   network_mode = "bridge"  # Isolate sandbox networks
   ```

5. **Network Policy Enforcement:**
   ```python
   # SDK usage with network restrictions
   sandbox = await Sandbox.create(
       "image",
       network_policy={
           "allowed_domains": ["api.example.com"],
           "allowed_ips": ["1.2.3.4/32"]
       }
   )
   ```

6. **Monitor Resource Usage:**
   ```bash
   # Check sandbox resource consumption
   docker stats $(docker ps -q --filter "label=opensandbox.sandbox_id")
   ```

### Network Isolation

OpenSandbox creates isolated networks per sandbox in bridge mode:

- Each sandbox gets its own Docker network
- Sandboxes cannot communicate with each other by default
- Use `networkPolicy` to restrict external connectivity

---

## Integration Examples

### With Existing Docker Compose (Aether Infrastructure)

```yaml
version: '3.8'

services:
  # Existing services
  aether-service:
    image: aether/service:latest
    # ... existing config ...
    networks:
      - aether-network

  # Add OpenSandbox
  opensandbox-server:
    image: opensandbox/server:latest
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./config/opensandbox.toml:/etc/opensandbox/config.toml:ro
    environment:
      - SANDBOX_CONFIG_PATH=/etc/opensandbox/config.toml
    networks:
      - aether-network  # Share network with existing services
    restart: unless-stopped

networks:
  aether-network:
    external: true  # Or define if not external
```

### Programmatic Integration (Python)

```python
from opensandbox import Sandbox
from datetime import timedelta

class SandboxManager:
    def __init__(self, api_url="http://localhost:8080", api_key=None):
        Sandbox.configure(api_url=api_url, api_key=api_key)
    
    async def create_code_sandbox(self, timeout_minutes=10):
        """Create Python code execution sandbox"""
        return await Sandbox.create(
            "opensandbox/code-interpreter:v1.0.2",
            entrypoint=["/opt/opensandbox/code-interpreter.sh"],
            timeout=timedelta(minutes=timeout_minutes)
        )
    
    async def execute_code(self, code: str, language="python"):
        """Execute code in isolated sandbox"""
        sandbox = await self.create_code_sandbox()
        try:
            result = await sandbox.run_code(language, code)
            return {
                "success": True,
                "output": result.text,
                "error": result.error
            }
        finally:
            await sandbox.close()

# Usage
manager = SandboxManager(api_url="http://opensandbox-server:8080")
result = await manager.execute_code("print('Hello from sandbox!')")
```

---

## Performance Tuning

### Optimize Cold Start Time

**Pre-pull images:**

```bash
docker pull opensandbox/execd:v1.0.10
docker pull opensandbox/egress:v1.0.6
docker pull opensandbox/code-interpreter:v1.0.2
```

**Use image caching:**

```toml
[docker]
# Images are cached after first use
# Subsequent sandboxes start faster
```

### Scale Horizontally

For high-load scenarios, run multiple server instances:

```yaml
services:
  opensandbox-server-1:
    image: opensandbox/server:latest
    ports:
      - "8080:8080"
    # ... config ...

  opensandbox-server-2:
    image: opensandbox/server:latest
    ports:
      - "8081:8080"
    # ... config ...

  # Add load balancer (nginx, traefik, etc.)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

**Note:** Each server instance needs access to Docker socket and can manage sandboxes independently.

---

## Monitoring & Observability

### Health Checks

```bash
# Server health
curl http://localhost:8080/health

# List active sandboxes (via API)
curl http://localhost:8080/sandboxes
```

### Prometheus Metrics (Future)

OpenSandbox doesn't expose Prometheus metrics natively yet. Monitor via Docker stats:

```bash
# Monitor sandbox resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
  $(docker ps -q --filter "label=opensandbox.sandbox_id")
```

### Logging

Aggregate logs with your existing logging infrastructure:

```yaml
services:
  opensandbox-server:
    # ... config ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    # Or use your existing logging driver (fluentd, splunk, etc.)
```

---

## Additional Resources

- **GitHub Repository:** https://github.com/alibaba/OpenSandbox
- **Documentation Site:** https://open-sandbox.ai/
- **Issue Tracker:** https://github.com/alibaba/OpenSandbox/issues
- **Python SDK:** `pip install opensandbox`
- **Example Configurations:** `server/opensandbox_server/examples/`

---

## Summary Checklist

Before deploying to production:

- [ ] Docker version 20.10+ installed
- [ ] Configuration file created with `pids_limit = 4096`
- [ ] API key set (if production deployment)
- [ ] Health check endpoint verified
- [ ] Test sandbox creation successful
- [ ] Resource limits configured (memory, CPU)
- [ ] Network isolation enabled (bridge mode)
- [ ] Monitoring/logging integrated
- [ ] Pre-pulled required images for faster cold start
- [ ] Backup/disaster recovery plan established

**You're ready to integrate OpenSandbox into your infrastructure!** 🎉
