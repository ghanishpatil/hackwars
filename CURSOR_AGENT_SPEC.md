# CTF PLATFORM - CURSOR AGENT IMPLEMENTATION SPEC

## 🤖 AGENT MODE INSTRUCTIONS

This specification is designed for Cursor Agent mode. Implement features sequentially in the order presented. All requirements are explicit and actionable.

---

## 📦 DEPENDENCIES TO INSTALL

Execute these commands before starting implementation:

```bash
# Backend dependencies
cd backend
npm install dockerode multer node-pty ws archiver

# Frontend dependencies  
cd ../frontend
npm install xterm xterm-addon-fit xterm-addon-web-links
```

---

# PHASE 1: SERVICE TEMPLATE MANAGEMENT

## TASK 1.1: Create Firestore Collections

### Collection: `service_templates`

**Path:** Firestore root collection
**Document ID:** Auto-generated
**Fields:**
```typescript
{
  templateId: string;              // Auto-generated doc ID
  name: string;                    // Display name
  type: 'web' | 'ssh' | 'database' | 'api' | 'other';
  difficulty: 'beginner' | 'advanced' | 'expert';
  dockerImage: string;             // Image name (e.g., "ctf/vuln-web:1.0")
  dockerfile: string | null;       // Base64 encoded Dockerfile if custom
  port: number;                    // Primary exposed port
  environmentVars: {               // Key-value pairs
    [key: string]: string;
  };
  flagPath: string;                // Path inside container (e.g., "/app/flag.txt")
  vulnerabilities: string[];       // List of vulnerability descriptions
  healthCheck: {
    type: 'http' | 'tcp' | 'exec';
    endpoint?: string;             // For HTTP (e.g., "/health")
    expectedStatus?: number;       // For HTTP (e.g., 200)
    command?: string;              // For exec (e.g., "curl localhost")
    interval: number;              // Seconds between checks
  };
  createdBy: string;               // Admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  usageCount: number;              // Incremented each match use
}
```

### Collection: `service_collections`

**Path:** Firestore root collection
**Document ID:** Auto-generated
**Fields:**
```typescript
{
  collectionId: string;            // Auto-generated doc ID
  name: string;                    // Display name
  difficulty: 'beginner' | 'advanced' | 'expert';
  description: string;
  serviceTemplateIds: string[];    // Array of templateIds (exactly 5)
  createdBy: string;               // Admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  isDefault: boolean;              // One default per difficulty
}
```

**Action:** Create these collections in Firestore manually or via backend initialization script.

---

## TASK 1.2: Backend Service - Service Template CRUD

### File: `backend/services/serviceTemplateService.js`

**Create new file with these functions:**

#### Function: `createServiceTemplate`
```typescript
async function createServiceTemplate(adminUid: string, data: {
  name: string;
  type: string;
  difficulty: string;
  dockerImage?: string;
  dockerfile?: string;  // Base64 encoded
  port: number;
  environmentVars: object;
  flagPath: string;
  vulnerabilities: string[];
  healthCheck: object;
}): Promise<ServiceTemplate>
```

**Logic:**
1. Validate required fields (name, type, difficulty, port, flagPath)
2. Validate dockerImage OR dockerfile is provided (not both, not neither)
3. If dockerfile provided:
   - Decode base64
   - Generate unique image name: `ctf-custom/${Date.now()}`
   - Build Docker image (call `buildDockerImage` helper)
   - Set dockerImage to generated name
4. Create Firestore document in `service_templates` with:
   - All provided fields
   - createdBy: adminUid
   - createdAt: serverTimestamp
   - updatedAt: serverTimestamp
   - isActive: true
   - usageCount: 0
5. Return created document

**Error Handling:**
- Throw `INVALID_INPUT` if validation fails
- Throw `DOCKER_BUILD_FAILED` if image build fails
- Throw `DUPLICATE_NAME` if name exists

---

#### Function: `updateServiceTemplate`
```typescript
async function updateServiceTemplate(
  templateId: string, 
  updates: Partial<ServiceTemplate>
): Promise<ServiceTemplate>
```

**Logic:**
1. Get existing template from Firestore
2. If not found, throw `NOT_FOUND`
3. If updates.dockerfile provided:
   - Build new Docker image
   - Update dockerImage field
4. Merge updates with existing data
5. Set updatedAt: serverTimestamp
6. Update Firestore document
7. Return updated document

---

#### Function: `deleteServiceTemplate`
```typescript
async function deleteServiceTemplate(templateId: string): Promise<void>
```

**Logic:**
1. Check if template is used in any active collections
2. If yes, throw `IN_USE` error
3. Set isActive: false (soft delete)
4. Do NOT delete document

---

#### Function: `listServiceTemplates`
```typescript
async function listServiceTemplates(filters?: {
  type?: string;
  difficulty?: string;
  isActive?: boolean;
}): Promise<ServiceTemplate[]>
```

**Logic:**
1. Query Firestore `service_templates` collection
2. Apply filters if provided
3. Order by createdAt desc
4. Return array of templates

---

#### Helper: `buildDockerImage`
```typescript
async function buildDockerImage(
  dockerfile: string, 
  imageName: string
): Promise<void>
```

**Logic:**
1. Write dockerfile to temp directory: `/tmp/dockerfiles/${imageName}/Dockerfile`
2. Use dockerode to build image:
   ```javascript
   const docker = new Docker();
   const stream = await docker.buildImage({
     context: `/tmp/dockerfiles/${imageName}`,
     src: ['Dockerfile']
   }, { t: imageName });
   ```
3. Wait for build completion
4. Clean up temp directory
5. If build fails, throw error with Docker output

---

## TASK 1.3: Backend Routes - Service Templates

### File: `backend/routes/serviceTemplates.js`

**Create new Express router:**

```javascript
const express = require('express');
const router = express.Router();
const { adminGuard } = require('../middleware/adminGuard');
const serviceTemplateService = require('../services/serviceTemplateService');
const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 } // 1MB max
});
```

#### Route: `POST /api/service-templates`
**Middleware:** adminGuard
**Body:**
```json
{
  "name": "string",
  "type": "web|ssh|database|api|other",
  "difficulty": "beginner|advanced|expert",
  "dockerImage": "string (optional)",
  "dockerfile": "string (optional, base64)",
  "port": number,
  "environmentVars": {},
  "flagPath": "string",
  "vulnerabilities": ["string"],
  "healthCheck": {}
}
```

**Handler:**
```javascript
router.post('/', adminGuard, async (req, res) => {
  try {
    const template = await serviceTemplateService.createServiceTemplate(
      req.user.uid,
      req.body
    );
    res.json({ success: true, template });
  } catch (error) {
    if (error.message === 'INVALID_INPUT') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'DOCKER_BUILD_FAILED') {
      return res.status(500).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Route: `POST /api/service-templates/upload-dockerfile`
**Middleware:** adminGuard, multer
**Form data:** `dockerfile` (file)

**Handler:**
```javascript
router.post('/upload-dockerfile', adminGuard, upload.single('dockerfile'), async (req, res) => {
  try {
    const dockerfileContent = req.file.buffer.toString('utf8');
    const base64 = Buffer.from(dockerfileContent).toString('base64');
    res.json({ success: true, dockerfile: base64 });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

#### Route: `GET /api/service-templates`
**Middleware:** adminGuard
**Query params:** type, difficulty, isActive

**Handler:**
```javascript
router.get('/', adminGuard, async (req, res) => {
  try {
    const templates = await serviceTemplateService.listServiceTemplates(req.query);
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});
```

#### Route: `GET /api/service-templates/:templateId`
**Middleware:** adminGuard

**Handler:**
```javascript
router.get('/:templateId', adminGuard, async (req, res) => {
  try {
    const template = await serviceTemplateService.getServiceTemplate(req.params.templateId);
    res.json({ success: true, template });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Route: `PATCH /api/service-templates/:templateId`
**Middleware:** adminGuard

**Handler:**
```javascript
router.patch('/:templateId', adminGuard, async (req, res) => {
  try {
    const template = await serviceTemplateService.updateServiceTemplate(
      req.params.templateId,
      req.body
    );
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});
```

#### Route: `DELETE /api/service-templates/:templateId`
**Middleware:** adminGuard

**Handler:**
```javascript
router.delete('/:templateId', adminGuard, async (req, res) => {
  try {
    await serviceTemplateService.deleteServiceTemplate(req.params.templateId);
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'IN_USE') {
      return res.status(400).json({ error: 'Template is in use' });
    }
    res.status(500).json({ error: 'Delete failed' });
  }
});
```

**Mount router in `backend/app.js`:**
```javascript
app.use('/api/service-templates', require('./routes/serviceTemplates'));
```

---

## TASK 1.4: Backend Service - Service Collections CRUD

### File: `backend/services/serviceCollectionService.js`

#### Function: `createServiceCollection`
```typescript
async function createServiceCollection(adminUid: string, data: {
  name: string;
  difficulty: string;
  description: string;
  serviceTemplateIds: string[];  // Exactly 5
  isDefault?: boolean;
}): Promise<ServiceCollection>
```

**Logic:**
1. Validate serviceTemplateIds.length === 5
2. Verify all templateIds exist in service_templates
3. If isDefault: true, set all other collections with same difficulty to isDefault: false
4. Create Firestore document in `service_collections`
5. Return created document

---

#### Function: `getDefaultCollectionForDifficulty`
```typescript
async function getDefaultCollectionForDifficulty(
  difficulty: string
): Promise<ServiceCollection>
```

**Logic:**
1. Query `service_collections` where:
   - difficulty === difficulty
   - isDefault === true
   - isActive === true
2. If not found, query any active collection with that difficulty
3. If still not found, throw `NO_COLLECTION_FOUND`
4. Return collection

---

## TASK 1.5: Frontend - Admin Service Templates Page

### File: `frontend/src/pages/admin/AdminServiceTemplates.jsx`

**Component Structure:**

```jsx
import { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';

export default function AdminServiceTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState({ type: '', difficulty: '' });

  useEffect(() => {
    fetchTemplates();
  }, [filter]);

  const fetchTemplates = async () => {
    setLoading(true);
    const response = await adminApi.getServiceTemplates(filter);
    setTemplates(response.templates);
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Service Templates</h1>
        <button onClick={() => setShowCreateModal(true)}>
          + Create Template
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select 
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="web">Web</option>
          <option value="ssh">SSH</option>
          <option value="database">Database</option>
          <option value="api">API</option>
          <option value="other">Other</option>
        </select>

        <select
          value={filter.difficulty}
          onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })}
        >
          <option value="">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {/* Templates List */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {templates.map(template => (
            <TemplateCard key={template.templateId} template={template} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchTemplates}
        />
      )}
    </div>
  );
}
```

---

### Component: `TemplateCard`

```jsx
function TemplateCard({ template }) {
  return (
    <div className="border border-gray-700 p-6 rounded">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold">{template.name}</h3>
          <div className="flex gap-4 mt-2 text-sm text-gray-400">
            <span>Type: {template.type}</span>
            <span>Difficulty: {template.difficulty}</span>
            <span>Port: {template.port}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="text-blue-400">Edit</button>
          <button className="text-red-400">Delete</button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-300">Docker Image: {template.dockerImage}</p>
        <p className="text-sm text-gray-300">Flag Path: {template.flagPath}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold">Vulnerabilities:</p>
        <ul className="list-disc list-inside text-sm text-gray-400">
          {template.vulnerabilities.map((vuln, i) => (
            <li key={i}>{vuln}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Used in {template.usageCount} matches
      </div>
    </div>
  );
}
```

---

### Component: `CreateTemplateModal`

```jsx
function CreateTemplateModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'web',
    difficulty: 'beginner',
    dockerImage: '',
    dockerfile: '',
    port: 80,
    environmentVars: {},
    flagPath: '/flag.txt',
    vulnerabilities: [],
    healthCheck: {
      type: 'http',
      endpoint: '/',
      expectedStatus: 200,
      interval: 30
    }
  });

  const [useDockerfile, setUseDockerfile] = useState(false);
  const [vulnerabilityInput, setVulnerabilityInput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createServiceTemplate(formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to create template: ' + error.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('dockerfile', file);

    const response = await adminApi.uploadDockerfile(formData);
    setFormData(prev => ({ ...prev, dockerfile: response.dockerfile }));
  };

  const addVulnerability = () => {
    if (vulnerabilityInput.trim()) {
      setFormData(prev => ({
        ...prev,
        vulnerabilities: [...prev.vulnerabilities, vulnerabilityInput.trim()]
      }));
      setVulnerabilityInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Create Service Template</h2>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              required
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
            >
              <option value="web">Web Application</option>
              <option value="ssh">SSH Server</option>
              <option value="database">Database</option>
              <option value="api">API</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
            >
              <option value="beginner">Beginner</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          {/* Docker Source */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Docker Source</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useDockerfile}
                  onChange={() => setUseDockerfile(false)}
                  className="mr-2"
                />
                Use Existing Image
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useDockerfile}
                  onChange={() => setUseDockerfile(true)}
                  className="mr-2"
                />
                Upload Dockerfile
              </label>
            </div>

            {!useDockerfile ? (
              <input
                type="text"
                placeholder="e.g., nginx:latest or ctf/vuln-web:1.0"
                value={formData.dockerImage}
                onChange={(e) => setFormData({ ...formData, dockerImage: e.target.value })}
                className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
                required={!useDockerfile}
              />
            ) : (
              <input
                type="file"
                accept=".dockerfile,Dockerfile"
                onChange={handleFileUpload}
                className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              />
            )}
          </div>

          {/* Port */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Port</label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              required
            />
          </div>

          {/* Flag Path */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Flag Path in Container</label>
            <input
              type="text"
              placeholder="/var/www/html/flag.txt"
              value={formData.flagPath}
              onChange={(e) => setFormData({ ...formData, flagPath: e.target.value })}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded"
              required
            />
          </div>

          {/* Vulnerabilities */}
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Vulnerabilities</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="e.g., SQL Injection in login"
                value={vulnerabilityInput}
                onChange={(e) => setVulnerabilityInput(e.target.value)}
                className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded"
              />
              <button type="button" onClick={addVulnerability} className="px-4 py-2 bg-blue-600 rounded">
                Add
              </button>
            </div>
            <ul className="list-disc list-inside text-sm">
              {formData.vulnerabilities.map((vuln, i) => (
                <li key={i}>{vuln}</li>
              ))}
            </ul>
          </div>

          {/* Submit */}
          <div className="flex gap-4 mt-6">
            <button type="submit" className="flex-1 py-2 bg-green-600 rounded">
              Create Template
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-600 rounded">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Add route in `frontend/src/App.jsx`:**
```jsx
<Route path="/admin/service-templates" element={<AdminServiceTemplates />} />
```

**Add navigation link in admin menu:**
```jsx
<Link to="/admin/service-templates">Service Templates</Link>
```

---

# PHASE 2: DOCKER ORCHESTRATION & MATCH PROVISIONING

## TASK 2.1: Match Engine - Docker Client Setup

### File: `match-engine/docker/dockerClient.js`

**Initialize Dockerode:**

```javascript
const Docker = require('dockerode');

const docker = new Docker({
  socketPath: '/var/run/docker.sock'  // Unix socket
  // OR for remote Docker:
  // host: process.env.DOCKER_HOST || 'localhost',
  // port: process.env.DOCKER_PORT || 2375
});

// Test connection
async function testConnection() {
  try {
    await docker.ping();
    console.log('Docker connection successful');
  } catch (error) {
    console.error('Docker connection failed:', error);
    throw error;
  }
}

module.exports = { docker, testConnection };
```

---

## TASK 2.2: Match Engine - Network Manager

### File: `match-engine/docker/networkManager.js`

#### Function: `createMatchNetwork`
```typescript
async function createMatchNetwork(matchId: string): Promise<{
  networkId: string;
  networkName: string;
  subnet: string;
}>
```

**Logic:**
1. Generate network name: `match-${matchId}`
2. Generate unique subnet: `172.20.${randomOctet}.0/24`
   - Keep registry of used subnets to avoid collisions
   - Use atomic counter or random with conflict check
3. Create Docker network:
   ```javascript
   const network = await docker.createNetwork({
     Name: `match-${matchId}`,
     Driver: 'bridge',
     IPAM: {
       Config: [{
         Subnet: subnet,
         Gateway: `172.20.${octet}.1`
       }]
     },
     Internal: false,  // Allow internet access
     Labels: {
       'ctf.match.id': matchId,
       'ctf.created': Date.now().toString()
     }
   });
   ```
4. Return network details

---

#### Function: `deleteMatchNetwork`
```typescript
async function deleteMatchNetwork(networkId: string): Promise<void>
```

**Logic:**
1. Get network by ID
2. Disconnect all containers
3. Remove network
4. Release subnet from registry

---

## TASK 2.3: Match Engine - Container Manager

### File: `match-engine/docker/containerManager.js`

#### Function: `provisionTeamServices`
```typescript
async function provisionTeamServices(
  matchId: string,
  teamId: string,
  networkId: string,
  serviceTemplates: ServiceTemplate[]
): Promise<ContainerInfo[]>
```

**Logic:**
1. For each service template in array:
   a. Generate container name: `match-${matchId}-${teamId}-${template.type}`
   b. Pull Docker image if not exists:
      ```javascript
      await docker.pull(template.dockerImage);
      ```
   c. Create container:
      ```javascript
      const container = await docker.createContainer({
        Image: template.dockerImage,
        name: containerName,
        Env: Object.entries(template.environmentVars).map(
          ([key, val]) => `${key}=${val}`
        ),
        ExposedPorts: {
          [`${template.port}/tcp`]: {}
        },
        HostConfig: {
          NetworkMode: networkId,
          Memory: 512 * 1024 * 1024,  // 512MB limit
          CpuQuota: 50000,  // 0.5 CPU
          RestartPolicy: { Name: 'on-failure', MaximumRetryCount: 3 }
        },
        Labels: {
          'ctf.match.id': matchId,
          'ctf.team.id': teamId,
          'ctf.service.type': template.type,
          'ctf.template.id': template.templateId
        }
      });
      ```
   d. Start container:
      ```javascript
      await container.start();
      ```
   e. Get container IP from network:
      ```javascript
      const inspect = await container.inspect();
      const containerIP = inspect.NetworkSettings.Networks[networkId].IPAddress;
      ```
   f. Store container info:
      ```javascript
      {
        containerId: container.id,
        containerName,
        serviceType: template.type,
        templateId: template.templateId,
        containerIP,
        port: template.port,
        flagPath: template.flagPath,
        healthCheck: template.healthCheck
      }
      ```

2. Return array of ContainerInfo objects

**Error Handling:**
- If any container fails, stop and remove all created containers
- Throw error with details

---

#### Function: `stopAndRemoveContainer`
```typescript
async function stopAndRemoveContainer(containerId: string): Promise<void>
```

**Logic:**
1. Get container
2. Stop (timeout 10 seconds)
3. Remove with force: true

---

#### Function: `injectFlagIntoContainer`
```typescript
async function injectFlagIntoContainer(
  containerId: string,
  flagPath: string,
  flagValue: string
): Promise<void>
```

**Logic:**
1. Get container
2. Execute command inside container:
   ```javascript
   const exec = await container.exec({
     Cmd: ['sh', '-c', `echo "${flagValue}" > ${flagPath}`],
     AttachStdout: true,
     AttachStderr: true
   });
   await exec.start({ Detach: false });
   ```
3. Verify execution success

**Security Note:** Escape flagValue to prevent command injection

---

## TASK 2.4: Match Engine - Match Provisioner

### File: `match-engine/services/matchProvisioner.js`

#### Function: `provisionMatch`
```typescript
async function provisionMatch(matchData: {
  matchId: string;
  difficulty: string;
  teamA: { teamId: string, players: Player[] };
  teamB: { teamId: string, players: Player[] };
}): Promise<MatchInfrastructure>
```

**Logic:**
1. Get service collection for difficulty:
   ```javascript
   const collection = await serviceCollectionService.getDefaultCollectionForDifficulty(
     matchData.difficulty
   );
   ```

2. Create match network:
   ```javascript
   const network = await networkManager.createMatchNetwork(matchData.matchId);
   ```

3. Provision services for Team A:
   ```javascript
   const teamAContainers = await containerManager.provisionTeamServices(
     matchData.matchId,
     matchData.teamA.teamId,
     network.networkId,
     collection.services
   );
   ```

4. Provision services for Team B:
   ```javascript
   const teamBContainers = await containerManager.provisionTeamServices(
     matchData.matchId,
     matchData.teamB.teamId,
     network.networkId,
     collection.services
   );
   ```

5. Generate initial flags (tick 0):
   ```javascript
   for (const container of [...teamAContainers, ...teamBContainers]) {
     const flag = generateFlag(matchData.matchId, container.teamId, container.serviceType, 0);
     await containerManager.injectFlagIntoContainer(
       container.containerId,
       container.flagPath,
       flag
     );
   }
   ```

6. Store infrastructure in state:
   ```javascript
   const infrastructure = {
     matchId: matchData.matchId,
     networkId: network.networkId,
     subnet: network.subnet,
     teamA: {
       teamId: matchData.teamA.teamId,
       containers: teamAContainers
     },
     teamB: {
       teamId: matchData.teamB.teamId,
       containers: teamBContainers
     },
     provisionedAt: Date.now()
   };
   await stateStore.setMatchInfrastructure(matchData.matchId, infrastructure);
   ```

7. Return infrastructure object

**Rollback on Error:**
- If any step fails, clean up all created resources
- Stop all containers
- Remove network
- Throw error

---

#### Helper: `generateFlag`
```typescript
function generateFlag(
  matchId: string,
  teamId: string,
  serviceType: string,
  tickNumber: number
): string
```

**Logic:**
1. Create payload: `${matchId}_${teamId}_${serviceType}_${tickNumber}`
2. Generate random suffix (8 chars): `crypto.randomBytes(4).toString('hex')`
3. Create HMAC signature:
   ```javascript
   const hmac = crypto.createHmac('sha256', process.env.FLAG_SECRET);
   hmac.update(payload);
   const signature = hmac.digest('hex').substring(0, 16);
   ```
4. Return: `FLAG{${signature}_${randomSuffix}}`

**Flag format:** `FLAG{a1b2c3d4e5f6g7h8_i9j0k1l2}`

---

## TASK 2.5: Match Engine - Cleanup Service

### File: `match-engine/services/matchCleanup.js`

#### Function: `cleanupMatch`
```typescript
async function cleanupMatch(matchId: string): Promise<void>
```

**Logic:**
1. Get match infrastructure from state store
2. Stop and remove all Team A containers
3. Stop and remove all Team B containers
4. Delete match network
5. Remove infrastructure from state store
6. Log cleanup completion

**Parallel Execution:**
- Use `Promise.all` to delete containers concurrently
- Timeout: 30 seconds per container

---

#### Function: `cleanupStaleMatches`
```typescript
async function cleanupStaleMatches(): Promise<void>
```

**Logic:**
1. List all Docker containers with label `ctf.match.id`
2. For each container:
   - Check if match still exists in state store
   - If not, or if created > 2 hours ago:
     - Stop and remove container
3. List all Docker networks with label `ctf.match.id`
4. For each network:
   - Check if match still exists
   - If not: Remove network

**Run as cron job:** Every 30 minutes

---

## TASK 2.6: Match Engine - HTTP Endpoints

### File: `match-engine/routes/matchRoutes.js`

#### Route: `POST /engine/match/provision`
**Body:**
```json
{
  "matchId": "string",
  "difficulty": "beginner|advanced|expert",
  "teamA": { "teamId": "string", "players": [] },
  "teamB": { "teamId": "string", "players": [] }
}
```

**Handler:**
```javascript
router.post('/match/provision', async (req, res) => {
  try {
    const infrastructure = await matchProvisioner.provisionMatch(req.body);
    
    // Update match in backend database
    await axios.post(`${BACKEND_URL}/api/match/infrastructure`, {
      matchId: req.body.matchId,
      infrastructure
    });

    res.json({ success: true, infrastructure });
  } catch (error) {
    console.error('Provisioning failed:', error);
    res.status(500).json({ error: 'Provisioning failed', details: error.message });
  }
});
```

#### Route: `POST /engine/match/:matchId/cleanup`
**Handler:**
```javascript
router.post('/match/:matchId/cleanup', async (req, res) => {
  try {
    await matchCleanup.cleanupMatch(req.params.matchId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Cleanup failed' });
  }
});
```

#### Route: `GET /engine/match/:matchId/infrastructure`
**Handler:**
```javascript
router.get('/match/:matchId/infrastructure', async (req, res) => {
  try {
    const infrastructure = await stateStore.getMatchInfrastructure(req.params.matchId);
    res.json({ success: true, infrastructure });
  } catch (error) {
    res.status(404).json({ error: 'Infrastructure not found' });
  }
});
```

---

# PHASE 3: NETWORK ACCESS & PLAYER INTERFACE

## TASK 3.1: NGINX Configuration Generator

### File: `match-engine/services/nginxConfigGenerator.js`

#### Function: `generateMatchConfig`
```typescript
async function generateMatchConfig(
  matchId: string,
  infrastructure: MatchInfrastructure
): Promise<void>
```

**Logic:**
1. Build NGINX configuration for this match:
   ```nginx
   # Match ${matchId} - Team A Services
   location /match/${matchId}/team-a/web {
       proxy_pass http://${teamA_web_IP}:${port};
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }

   location /match/${matchId}/team-a/ssh {
       proxy_pass http://localhost:${assigned_ssh_port};
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }

   # Repeat for all services both teams
   ```

2. Write config to file:
   ```javascript
   const configPath = `/etc/nginx/conf.d/match-${matchId}.conf`;
   await fs.writeFile(configPath, nginxConfig);
   ```

3. Reload NGINX:
   ```javascript
   await exec('nginx -s reload');
   ```

4. Store port mappings in state store

---

#### Function: `removeMatchConfig`
```typescript
async function removeMatchConfig(matchId: string): Promise<void>
```

**Logic:**
1. Delete config file: `/etc/nginx/conf.d/match-${matchId}.conf`
2. Reload NGINX

---

## TASK 3.2: Web Terminal Service

### File: `match-engine/services/terminalService.js`

**Dependencies:**
```javascript
const pty = require('node-pty');
const WebSocket = require('ws');
```

#### Function: `createTerminalSession`
```typescript
function createTerminalSession(
  ws: WebSocket,
  containerId: string
): void
```

**Logic:**
1. Spawn SSH process to container:
   ```javascript
   const shell = pty.spawn('docker', ['exec', '-it', containerId, '/bin/bash'], {
     name: 'xterm-color',
     cols: 80,
     rows: 30,
     cwd: process.env.HOME,
     env: process.env
   });
   ```

2. Forward shell output to WebSocket:
   ```javascript
   shell.on('data', (data) => {
     ws.send(data);
   });
   ```

3. Forward WebSocket input to shell:
   ```javascript
   ws.on('message', (msg) => {
     shell.write(msg);
   });
   ```

4. Handle cleanup:
   ```javascript
   ws.on('close', () => {
     shell.kill();
   });
   ```

---

### File: `match-engine/routes/terminalRoutes.js`

#### WebSocket Route: `/terminal/:matchId/:teamId/:serviceType`

**Handler:**
```javascript
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  const match = pathname.match(/^\/terminal\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
  
  if (match) {
    const [, matchId, teamId, serviceType] = match;
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Get container for this service
      const infrastructure = await stateStore.getMatchInfrastructure(matchId);
      const container = findContainer(infrastructure, teamId, serviceType);
      
      terminalService.createTerminalSession(ws, container.containerId);
    });
  } else {
    socket.destroy();
  }
});
```

---

## TASK 3.3: Frontend - Live Match Page Enhancement

### File: `frontend/src/pages/LiveMatch.jsx`

**Add service access interface:**

```jsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

function ServiceAccessPanel({ matchId, teamId, service }) {
  const terminalRef = useRef(null);
  const [terminal, setTerminal] = useState(null);

  const openTerminal = () => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Courier New, monospace',
      theme: {
        background: '#0a0e14',
        foreground: '#00ff41'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Connect to WebSocket
    const ws = new WebSocket(
      `${WS_URL}/terminal/${matchId}/${teamId}/${service.type}`
    );

    ws.onopen = () => {
      term.write('\r\n*** Connected to service ***\r\n\r\n');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    term.onData((data) => {
      ws.send(data);
    });

    ws.onclose = () => {
      term.write('\r\n*** Connection closed ***\r\n');
    };

    setTerminal(term);
  };

  return (
    <div className="service-panel border border-gray-700 p-4 rounded">
      <h3 className="font-bold text-lg mb-2">{service.name}</h3>
      <p className="text-sm text-gray-400 mb-4">
        {service.type} • {service.containerIP}:{service.port}
      </p>

      <div className="flex gap-2 mb-4">
        {service.type === 'web' && (
          <a 
            href={`/match/${matchId}/team-${teamId}/${service.type}`}
            target="_blank"
            className="px-4 py-2 bg-blue-600 rounded"
          >
            Open in Browser
          </a>
        )}
        
        {service.type === 'ssh' && (
          <button onClick={openTerminal} className="px-4 py-2 bg-green-600 rounded">
            Open Terminal
          </button>
        )}

        <button className="px-4 py-2 bg-purple-600 rounded">
          Submit Flag
        </button>
      </div>

      {terminal && (
        <div ref={terminalRef} className="terminal-container h-96 bg-gray-900 p-2 rounded" />
      )}
    </div>
  );
}
```

---

# PHASE 4: REAL-TIME SCORING & TICK SYSTEM

## TASK 4.1: Match Engine - Tick Manager

### File: `match-engine/services/tickManager.js`

#### Function: `startTickSystem`
```typescript
function startTickSystem(matchId: string, duration: number): void
```

**Logic:**
1. Calculate total ticks: `Math.floor(duration / 60)` (1 tick = 60 seconds)
2. Initialize tick counter: 0
3. Start interval (60 seconds):
   ```javascript
   const tickInterval = setInterval(async () => {
     currentTick++;
     
     if (currentTick >= totalTicks) {
       clearInterval(tickInterval);
       await endMatch(matchId);
       return;
     }

     await processTick(matchId, currentTick);
   }, 60000);
   ```

4. Store interval ID in state for cleanup

---

#### Function: `processTick`
```typescript
async function processTick(matchId: string, tickNumber: number): Promise<void>
```

**Logic:**
1. Get match infrastructure
2. Generate new flags for all services:
   ```javascript
   for (const team of [infrastructure.teamA, infrastructure.teamB]) {
     for (const container of team.containers) {
       const newFlag = generateFlag(matchId, team.teamId, container.serviceType, tickNumber);
       await injectFlagIntoContainer(container.containerId, container.flagPath, newFlag);
       
       // Store flag in database for validation
       await stateStore.storeFlag({
         matchId,
         teamId: team.teamId,
         serviceType: container.serviceType,
         tick: tickNumber,
         flag: newFlag,
         captured: false
       });
     }
   }
   ```

3. Run health checks on all services:
   ```javascript
   for (const team of [infrastructure.teamA, infrastructure.teamB]) {
     for (const container of team.containers) {
       const isHealthy = await healthChecker.checkService(
         container.containerIP,
         container.port,
         container.healthCheck
       );
       
       // Award/penalize points
       const points = isHealthy ? +10 : -20;
       await scorer.addDefensePoints(matchId, team.teamId, container.serviceType, points);
     }
   }
   ```

4. Broadcast tick update via Socket.IO:
   ```javascript
   io.to(`match:${matchId}`).emit('tick:update', {
     tickNumber,
     scores: await scorer.getScores(matchId)
   });
   ```

---

## TASK 4.2: Match Engine - Health Checker

### File: `match-engine/services/healthChecker.js`

#### Function: `checkService`
```typescript
async function checkService(
  containerIP: string,
  port: number,
  healthCheck: HealthCheckConfig
): Promise<boolean>
```

**Logic based on health check type:**

**HTTP Check:**
```javascript
if (healthCheck.type === 'http') {
  try {
    const response = await axios.get(`http://${containerIP}:${port}${healthCheck.endpoint}`, {
      timeout: 5000
    });
    return response.status === healthCheck.expectedStatus;
  } catch (error) {
    return false;
  }
}
```

**TCP Check:**
```javascript
if (healthCheck.type === 'tcp') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    
    socket.connect(port, containerIP, () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
```

**Exec Check:**
```javascript
if (healthCheck.type === 'exec') {
  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['sh', '-c', healthCheck.command],
      AttachStdout: true
    });
    const stream = await exec.start();
    // Check exit code
    return true;
  } catch (error) {
    return false;
  }
}
```

---

## TASK 4.3: Match Engine - Scorer

### File: `match-engine/services/scorer.js`

**State structure in memory:**
```javascript
const matchScores = {
  [matchId]: {
    teamA: {
      attack: 0,    // Points from captures
      defense: 0,   // Points from service uptime
      total: 0
    },
    teamB: {
      attack: 0,
      defense: 0,
      total: 0
    }
  }
};
```

#### Function: `addAttackPoints`
```typescript
async function addAttackPoints(
  matchId: string,
  teamId: string,
  serviceType: string,
  points: number
): Promise<void>
```

**Logic:**
1. Get current scores
2. Add to attack points
3. Recalculate total
4. Update state
5. Broadcast via Socket.IO

---

#### Function: `addDefensePoints`
```typescript
async function addDefensePoints(
  matchId: string,
  teamId: string,
  serviceType: string,
  points: number
): Promise<void>
```

**Logic:** Same as attack, but updates defense points

---

## TASK 4.4: Match Engine - Flag Validator

### File: `match-engine/services/flagValidator.js`

#### Function: `validateFlag`
```typescript
async function validateFlag(
  matchId: string,
  submittingTeamId: string,
  flagValue: string
): Promise<{
  valid: boolean;
  points: number;
  reason?: string;
}>
```

**Logic:**
1. Query flags from state store:
   ```javascript
   const flag = await stateStore.getFlag(matchId, flagValue);
   ```

2. Validate:
   ```javascript
   if (!flag) {
     return { valid: false, reason: 'Invalid flag' };
   }

   if (flag.teamId === submittingTeamId) {
     return { valid: false, reason: 'Cannot capture own flag' };
   }

   if (flag.captured) {
     // Already captured by someone
     // Allow recapture for fewer points (50 instead of 100)
     if (flag.capturedBy === submittingTeamId) {
       return { valid: false, reason: 'Already captured by your team' };
     }
     return { valid: true, points: 50 };
   }

   // First capture
   return { valid: true, points: 100 };
   ```

3. If valid, update flag state:
   ```javascript
   await stateStore.updateFlag(flagValue, {
     captured: true,
     capturedBy: submittingTeamId,
     capturedAt: Date.now()
   });
   ```

4. Award points:
   ```javascript
   await scorer.addAttackPoints(matchId, submittingTeamId, flag.serviceType, points);
   ```

5. Return result

---

## TASK 4.5: Match Engine - Flag Submission Endpoint

### File: `match-engine/routes/flagRoutes.js`

#### Route: `POST /engine/flag/submit`
**Body:**
```json
{
  "matchId": "string",
  "teamId": "string",
  "playerId": "string",
  "flag": "string"
}
```

**Middleware:** Rate limit (30 submissions per minute per team)

**Handler:**
```javascript
router.post('/flag/submit', flagRateLimiter, async (req, res) => {
  try {
    const { matchId, teamId, playerId, flag } = req.body;

    const result = await flagValidator.validateFlag(matchId, teamId, flag);

    if (!result.valid) {
      return res.status(400).json({ 
        success: false, 
        error: result.reason 
      });
    }

    // Broadcast capture event
    io.to(`match:${matchId}`).emit('flag:captured', {
      teamId,
      playerId,
      flag,
      points: result.points
    });

    res.json({ 
      success: true, 
      points: result.points,
      message: 'Flag accepted!'
    });

  } catch (error) {
    res.status(500).json({ error: 'Submission failed' });
  }
});
```

---

## TASK 4.6: Frontend - Flag Submission UI

### Component: `FlagSubmissionModal`

```jsx
function FlagSubmissionModal({ matchId, teamId, onClose }) {
  const [flag, setFlag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${ENGINE_URL}/engine/flag/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          teamId,
          playerId: currentUser.uid,
          flag
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: `+${data.points} points!`, points: data.points });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setResult({ type: 'error', message: data.error });
      }
    } catch (error) {
      setResult({ type: 'error', message: 'Submission failed' });
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Submit Flag</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            placeholder="FLAG{...}"
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded mb-4 font-mono"
            required
            disabled={submitting}
          />

          {result && (
            <div className={`p-3 rounded mb-4 ${
              result.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
            }`}>
              {result.message}
            </div>
          )}

          <div className="flex gap-4">
            <button 
              type="submit" 
              disabled={submitting}
              className="flex-1 py-2 bg-green-600 rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 bg-gray-600 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

# PHASE 5: TEAM FORMATION & MATCHMAKING ENHANCEMENT

## TASK 5.1: Database Schema - Teams

### Collection: `teams`

**Create in Firestore:**
```typescript
{
  teamId: string;              // Auto-generated
  name: string;                // Unique
  leaderId: string;            // UID
  members: [{
    uid: string;
    username: string;
    mmr: number;
    joinedAt: Timestamp;
  }];
  maxSize: number;             // 2, 3, or 4
  currentSize: number;
  inviteCode: string;          // 6 chars, unique
  averageMMR: number;          // Calculated
  createdAt: Timestamp;
  isActive: boolean;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
}
```

### Update `users` collection:

**Add fields:**
```typescript
{
  // ... existing fields
  currentTeamId: string | null;
  onlineStatus: {
    isOnline: boolean;
    lastHeartbeat: Timestamp;
    currentPage: 'matchmaking' | 'match' | 'offline';
  };
}
```

---

## TASK 5.2: Backend Service - Team Management

### File: `backend/services/teamService.js`

#### Function: `createTeam`
```typescript
async function createTeam(userId: string, data: {
  name: string;
  maxSize: number;
}): Promise<Team>
```

**Logic:**
1. Check user not already in team:
   ```javascript
   const user = await db.collection('users').doc(userId).get();
   if (user.data().currentTeamId) {
     throw new Error('ALREADY_IN_TEAM');
   }
   ```

2. Check name uniqueness:
   ```javascript
   const existing = await db.collection('teams').where('name', '==', data.name).get();
   if (!existing.empty) {
     throw new Error('NAME_TAKEN');
   }
   ```

3. Generate invite code (6 chars, unique):
   ```javascript
   let inviteCode;
   let codeExists = true;
   while (codeExists) {
     inviteCode = generateCode(6);  // Random A-Z0-9
     const check = await db.collection('teams').where('inviteCode', '==', inviteCode).get();
     codeExists = !check.empty;
   }
   ```

4. Create team document:
   ```javascript
   const teamRef = db.collection('teams').doc();
   await teamRef.set({
     teamId: teamRef.id,
     name: data.name,
     leaderId: userId,
     members: [{
       uid: userId,
       username: user.data().username,
       mmr: user.data().mmr,
       joinedAt: admin.firestore.FieldValue.serverTimestamp()
     }],
     maxSize: data.maxSize,
     currentSize: 1,
     inviteCode,
     averageMMR: user.data().mmr,
     createdAt: admin.firestore.FieldValue.serverTimestamp(),
     isActive: true,
     stats: { matchesPlayed: 0, wins: 0, losses: 0 }
   });
   ```

5. Update user:
   ```javascript
   await db.collection('users').doc(userId).update({
     currentTeamId: teamRef.id
   });
   ```

6. Return team

---

#### Function: `joinTeam`
```typescript
async function joinTeam(userId: string, inviteCode: string): Promise<Team>
```

**Logic:**
1. Find team by invite code:
   ```javascript
   const teamQuery = await db.collection('teams')
     .where('inviteCode', '==', inviteCode)
     .where('isActive', '==', true)
     .get();
   
   if (teamQuery.empty) throw new Error('INVALID_CODE');
   const teamDoc = teamQuery.docs[0];
   const team = teamDoc.data();
   ```

2. Check if team full:
   ```javascript
   if (team.currentSize >= team.maxSize) {
     throw new Error('TEAM_FULL');
   }
   ```

3. Check user not in another team:
   ```javascript
   const user = await db.collection('users').doc(userId).get();
   if (user.data().currentTeamId) {
     throw new Error('ALREADY_IN_TEAM');
   }
   ```

4. Add member:
   ```javascript
   const newMember = {
     uid: userId,
     username: user.data().username,
     mmr: user.data().mmr,
     joinedAt: admin.firestore.FieldValue.serverTimestamp()
   };

   const updatedMembers = [...team.members, newMember];
   const averageMMR = updatedMembers.reduce((sum, m) => sum + m.mmr, 0) / updatedMembers.length;

   await teamDoc.ref.update({
     members: updatedMembers,
     currentSize: team.currentSize + 1,
     averageMMR
   });
   ```

5. Update user:
   ```javascript
   await db.collection('users').doc(userId).update({
     currentTeamId: team.teamId
   });
   ```

6. Return updated team

---

#### Function: `leaveTeam`
```typescript
async function leaveTeam(userId: string): Promise<void>
```

**Logic:**
1. Get user's team
2. Remove from members array
3. If team becomes empty → soft delete (isActive: false)
4. If user was leader and members remain → transfer leadership to oldest member
5. Recalculate average MMR
6. Clear user's currentTeamId

---

## TASK 5.3: Backend Routes - Teams

### File: `backend/routes/teams.js`

**Create router with these routes:**

- `POST /api/teams/create`
- `POST /api/teams/join`
- `POST /api/teams/leave`
- `DELETE /api/teams/:teamId/disband` (leader only)
- `GET /api/teams/:teamId`

**Mount in app.js:**
```javascript
app.use('/api/teams', require('./routes/teams'));
```

---

## TASK 5.4: Frontend - Team Setup Page

### File: `frontend/src/pages/TeamSetup.jsx`

**Component with three options:**
1. Create Team (opens modal)
2. Join Team (opens modal with code input)
3. Skip (sets localStorage flag, navigates to matchmaking)

**On successful team create/join:**
- Navigate to `/matchmaking`

---

# PHASE 6: ONLINE PRESENCE & CHALLENGE SYSTEM

## TASK 6.1: Database Schema - Online Presence

### Collection: `online_users`

```typescript
{
  uid: string;                 // Document ID
  username: string;
  mmr: number;
  rank: string;
  teamId: string | null;
  teamName: string | null;
  isInQueue: boolean;
  isInMatch: boolean;
  lastHeartbeat: Timestamp;
}
```

### Collection: `challenges`

```typescript
{
  challengeId: string;         // Auto-generated
  fromId: string;              // Team ID or Player UID
  fromType: 'team' | 'solo';
  fromName: string;
  toId: string;
  toType: 'team' | 'solo';
  toName: string;
  difficulty: string;
  teamSize: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Timestamp;
  expiresAt: Timestamp;        // createdAt + 2 minutes
}
```

---

## TASK 6.2: Backend Service - Presence Management

### File: `backend/services/presenceService.js`

#### Function: `updateHeartbeat`
```typescript
async function updateHeartbeat(userId: string, currentPage: string): Promise<number>
```

**Logic:**
1. Get user data
2. Update/create online_users document:
   ```javascript
   await db.collection('online_users').doc(userId).set({
     uid: userId,
     username: user.username,
     mmr: user.mmr,
     rank: user.rank,
     teamId: user.currentTeamId || null,
     teamName: user.currentTeamId ? (await getTeamName(user.currentTeamId)) : null,
     isInQueue: await checkIfInQueue(userId),
     isInMatch: await checkIfInMatch(userId),
     lastHeartbeat: admin.firestore.FieldValue.serverTimestamp()
   }, { merge: true });
   ```

3. Update user document:
   ```javascript
   await db.collection('users').doc(userId).update({
     'onlineStatus.isOnline': true,
     'onlineStatus.lastHeartbeat': admin.firestore.FieldValue.serverTimestamp(),
     'onlineStatus.currentPage': currentPage
   });
   ```

4. Clean up stale entries (lastHeartbeat > 2 min ago):
   ```javascript
   const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
   const staleUsers = await db.collection('online_users')
     .where('lastHeartbeat', '<', twoMinutesAgo)
     .get();

   const batch = db.batch();
   staleUsers.docs.forEach(doc => batch.delete(doc.ref));
   await batch.commit();
   ```

5. Return online count

---

#### Function: `getOnlineUsers`
```typescript
async function getOnlineUsers(filters: {
  mode?: 'solo' | 'team';
  minMMR?: number;
  maxMMR?: number;
}): Promise<{ players: User[], teams: Team[] }>
```

**Logic:**
1. Query online_users where:
   - isInQueue === false
   - isInMatch === false
   - Optional: MMR filters
2. Separate into solo players (teamId === null) and team members
3. Group team members by teamId
4. Fetch full team documents
5. Return { players, teams }

---

## TASK 6.3: Backend Service - Challenge Management

### File: `backend/services/challengeService.js`

#### Function: `sendChallenge`
```typescript
async function sendChallenge(fromId: string, data: {
  targetId: string;
  targetType: 'team' | 'solo';
  difficulty: string;
  teamSize: number;
}): Promise<Challenge>
```

**Logic:**
1. Verify target is online and available
2. Verify sender is available (not in queue/match)
3. Create challenge document:
   ```javascript
   const challengeRef = db.collection('challenges').doc();
   await challengeRef.set({
     challengeId: challengeRef.id,
     fromId,
     fromType: data.targetType,  // Assuming same type
     fromName: await getName(fromId, data.targetType),
     toId: data.targetId,
     toType: data.targetType,
     toName: await getName(data.targetId, data.targetType),
     difficulty: data.difficulty,
     teamSize: data.teamSize,
     status: 'pending',
     createdAt: admin.firestore.FieldValue.serverTimestamp(),
     expiresAt: new Date(Date.now() + 2 * 60 * 1000)
   });
   ```

4. Return challenge

---

#### Function: `respondToChallenge`
```typescript
async function respondToChallenge(
  challengeId: string,
  action: 'accept' | 'decline'
): Promise<{ success: boolean, matchId?: string }>
```

**Logic:**
1. Get challenge document
2. Check if expired:
   ```javascript
   if (Date.now() > challenge.expiresAt.toMillis()) {
     await updateChallenge(challengeId, { status: 'expired' });
     throw new Error('CHALLENGE_EXPIRED');
   }
   ```

3. If decline:
   ```javascript
   await updateChallenge(challengeId, { status: 'declined' });
   return { success: true };
   ```

4. If accept:
   ```javascript
   // Create match immediately
   const matchId = await matchService.createMatch({
     type: 'challenge',
     difficulty: challenge.difficulty,
     teamSize: challenge.teamSize,
     teamA: await buildTeamData(challenge.fromId, challenge.fromType),
     teamB: await buildTeamData(challenge.toId, challenge.toType)
   });

   await updateChallenge(challengeId, { status: 'accepted' });
   return { success: true, matchId };
   ```

---

## TASK 6.4: Backend Routes - Presence & Challenges

### File: `backend/routes/presence.js`

#### Route: `POST /api/presence/heartbeat`
**Middleware:** authenticateUser
**Body:** `{ currentPage: string }`

**Handler:**
```javascript
router.post('/heartbeat', authenticateUser, async (req, res) => {
  const onlineCount = await presenceService.updateHeartbeat(
    req.user.uid,
    req.body.currentPage
  );
  res.json({ success: true, onlineCount });
});
```

---

### File: `backend/routes/challenges.js`

#### Route: `POST /api/challenges/send`
**Middleware:** authenticateUser

#### Route: `POST /api/challenges/:challengeId/respond`
**Middleware:** authenticateUser

#### Route: `GET /api/challenges/received`
**Middleware:** authenticateUser

---

## TASK 6.5: Socket.IO Events - Challenges & Presence

### File: `backend/socket.js`

**Add these event handlers:**

```javascript
io.on('connection', (socket) => {
  
  // User goes online
  socket.on('presence:online', async ({ uid }) => {
    socket.userId = uid;
    await presenceService.updateHeartbeat(uid, 'online');
    
    const onlineUsers = await presenceService.getOnlineUsers({});
    io.to('matchmaking').emit('online_users:update', onlineUsers);
  });

  // User joins matchmaking room
  socket.on('matchmaking:join', () => {
    socket.join('matchmaking');
  });

  // Challenge sent
  socket.on('challenge:send', async (data) => {
    const challenge = await challengeService.sendChallenge(socket.userId, data);
    
    // Notify target
    io.to(`user:${data.targetId}`).emit('challenge:received', challenge);
  });

  // Challenge response
  socket.on('challenge:respond', async ({ challengeId, action }) => {
    const result = await challengeService.respondToChallenge(challengeId, action);

    const challenge = await db.collection('challenges').doc(challengeId).get();
    const challengeData = challenge.data();

    if (action === 'accept') {
      // Notify challenger
      io.to(`user:${challengeData.fromId}`).emit('challenge:accepted', {
        challengeId,
        matchId: result.matchId
      });
      
      // Notify both to redirect
      io.to(`user:${challengeData.fromId}`).emit('match:start', { matchId: result.matchId });
      io.to(`user:${challengeData.toId}`).emit('match:start', { matchId: result.matchId });
    } else {
      io.to(`user:${challengeData.fromId}`).emit('challenge:declined', { challengeId });
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    if (socket.userId) {
      await db.collection('users').doc(socket.userId).update({
        'onlineStatus.isOnline': false
      });
    }
  });
});
```

---

## TASK 6.6: Frontend - Matchmaking Hub

### File: `frontend/src/pages/MatchmakingHub.jsx`

**Complete page with:**
1. Left panel: Match settings (mode, difficulty, team size)
2. Right panel: Online players/teams list with challenge buttons
3. Socket.IO connection with heartbeat (every 30s)
4. Online list refresh (every 10s)
5. Challenge modal (when receiving challenges)
6. Queue status indicator

---

## TASK 6.7: Frontend - Challenge Modal

### Component: `ChallengeModal`

```jsx
function ChallengeModal({ challenge, onAccept, onDecline }) {
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onDecline();  // Auto-decline
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-red-400">Challenge Received!</h2>
        
        <div className="mb-6">
          <p className="text-lg mb-2">
            <span className="text-green-400 font-bold">{challenge.fromName}</span> challenges you!
          </p>
          <p className="text-gray-400">Difficulty: {challenge.difficulty}</p>
          <p className="text-gray-400">Team Size: {challenge.teamSize}v{challenge.teamSize}</p>
        </div>

        <div className="mb-6 text-center">
          <p className="text-sm text-gray-400 mb-2">Time remaining</p>
          <p className="text-4xl font-mono font-bold text-yellow-400">
            {formatTime(timeLeft)}
          </p>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onAccept}
            className="flex-1 py-3 bg-green-600 rounded font-bold hover:bg-green-700"
          >
            Accept
          </button>
          <button 
            onClick={onDecline}
            className="flex-1 py-3 bg-red-600 rounded font-bold hover:bg-red-700"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

# IMPLEMENTATION CHECKLIST

## Phase 1: Service Management ✓
- [ ] Create `service_templates` collection
- [ ] Create `service_collections` collection
- [ ] Implement `serviceTemplateService.js`
- [ ] Create `/api/service-templates` routes
- [ ] Build admin UI for templates
- [ ] Test template creation and Docker builds

## Phase 2: Docker Orchestration ✓
- [ ] Install dockerode
- [ ] Implement `dockerClient.js`
- [ ] Implement `networkManager.js`
- [ ] Implement `containerManager.js`
- [ ] Implement `matchProvisioner.js`
- [ ] Create `/engine/match/provision` endpoint
- [ ] Test full provisioning flow

## Phase 3: Network Access ✓
- [ ] Install xterm.js and node-pty
- [ ] Implement `nginxConfigGenerator.js`
- [ ] Implement `terminalService.js`
- [ ] Create WebSocket terminal endpoint
- [ ] Update LiveMatch page with service panels
- [ ] Test terminal and web access

## Phase 4: Scoring System ✓
- [ ] Implement `tickManager.js`
- [ ] Implement `healthChecker.js`
- [ ] Implement `scorer.js`
- [ ] Implement `flagValidator.js`
- [ ] Create `/engine/flag/submit` endpoint
- [ ] Build flag submission UI
- [ ] Test complete tick cycle

## Phase 5: Teams ✓
- [ ] Create `teams` collection
- [ ] Update `users` collection schema
- [ ] Implement `teamService.js`
- [ ] Create `/api/teams` routes
- [ ] Build TeamSetup page
- [ ] Test team creation and joining

## Phase 6: Presence & Challenges ✓
- [ ] Create `online_users` collection
- [ ] Create `challenges` collection
- [ ] Implement `presenceService.js`
- [ ] Implement `challengeService.js`
- [ ] Add Socket.IO events
- [ ] Build MatchmakingHub page
- [ ] Build ChallengeModal component
- [ ] Test end-to-end challenge flow

---

# CRITICAL NOTES

## Security
- Never expose FLAG_SECRET environment variable
- Validate all user inputs server-side
- Rate limit flag submissions (30/min per team)
- Sanitize Docker exec commands to prevent injection
- Use transactions for team join/leave operations

## Performance
- Clean up stale containers every 30 minutes
- Limit concurrent matches (default 50)
- Index Firestore queries (online_users.lastHeartbeat)
- Use Docker resource limits (512MB RAM, 0.5 CPU per container)

## Error Handling
- Always rollback on provisioning failure
- Log all Docker errors with context
- Gracefully handle container crashes
- Implement match recovery for engine restarts

## Testing
- Test with 10+ concurrent matches
- Test challenge expiration timing
- Test team full/leave edge cases
- Load test flag submission endpoint
- Verify network isolation between matches

---

END OF SPECIFICATION
