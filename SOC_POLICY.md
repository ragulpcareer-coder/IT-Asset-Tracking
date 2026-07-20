# ENTERPRISE SOC INCIDENT RESPONSE PLAYBOOK
## Standard Operating Procedures (SOP) - SOC Tier 1/2/3

### 1. Incident Detection & Triage (§Category 3/9)
- **Automatic Detection**: Triggered by `DetectionEngine.js` mapping to MITRE ATT&CK.
- **Triage Level 1**: Analysts verify the `forensic-security.log` for anomalous process spawns or C2 heartbeats.
- **Triage Level 2**: Escalate if `PRIVILEGE_ESCALATION` or `DATA_EXFILTRATION` techniques are identified.

### 2. Playbook: Rogue Device Discovery (§Category 5)
1. **Identification**: `Cyber-Forensics SOC` flags a non-registered MAC.
2. **Containment**: Scan ports via `assetController.scanNetwork`.
3. **Eradication**: Disconnect asset via network management (if integrated) or physical removal.
4. **Recovery**: Re-audit the network segment.

### 3. Playbook: Prompt Injection / AI Attack (§SOC AI Category)
1. **Identification**: `Adversarial IQ Shield` increments on anomalous payload.
2. **Analysis**: Inspect `auditLog` meta for injection strings (e.g., "ignore previous instructions").
3. **Response**: Blacklist source IP in `firewall-config` (simulated via global rate limiter).

### 4. Continuous Improvement (§Category 6)
- **Weekly Threat Hunt**: Analysts use the `AuditLogs.jsx` filter to scan for `T1059` (Command execution) from standard user accounts.
- **SOAR Automation**: Automatic lockout of accounts on 5 failed attempts (Logic implemented in `authController.js`).

### 5. SOC Architecture Redundancy (§Category 2/10)
- **Shadow Logging**: Security logs are dual-piped to `soc-redundancy-shadow.log`.
- **Zero Trust**: Every request is re-validated against the database identity provider (No reliance on client tokens).
