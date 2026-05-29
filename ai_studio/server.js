const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const url = require('url');

const PORT = 3000;
const WORKSPACE_DIR = process.cwd();

// In-memory sync states for the AI Companion Chat UI
let chatHistory = [];
let pendingPrompt = null;

// Helper to sanitize path traversal attacks
function safePath(targetPath) {
    const resolved = path.resolve(WORKSPACE_DIR, targetPath);
    if (!resolved.toLowerCase().startsWith(WORKSPACE_DIR.toLowerCase())) {
        throw new Error('Access Denied: Out of workspace bounds');
    }
    return resolved;
}

// Parse request body helper
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
    });
}

// Map content-types for basic static file server
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.png': 'image/png'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // API Endpoint: Chat history and synchronization
        if (pathname === '/api/chat') {
            if (method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ history: chatHistory }));
                return;
            }
            if (method === 'POST') {
                const body = await getRequestBody(req);
                const userMsg = { role: 'user', content: body.message || '' };
                chatHistory.push(userMsg);
                pendingPrompt = body.message || '';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }
        }

        // API Endpoint: Long-poll or fetch pending prompts for TUI
        if (pathname === '/api/chat-poll') {
            if (method === 'GET') {
                const prompt = pendingPrompt;
                pendingPrompt = null; // consume
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ prompt: prompt || null }));
                return;
            }
            if (method === 'POST') {
                const body = await getRequestBody(req);
                const assistantMsg = { role: 'assistant', content: body.message || '', tools: body.tools || [] };
                chatHistory.push(assistantMsg);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                return;
            }
        }

        // API Endpoint: List workspace files
        if (pathname === '/api/files' && method === 'GET') {
            const items = fs.readdirSync(WORKSPACE_DIR);
            const filesList = {};
            
            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules' || item === 'chrome_profile_copy') continue;
                try {
                    const fullPath = path.join(WORKSPACE_DIR, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile()) {
                        filesList[item] = fs.readFileSync(fullPath, 'utf8');
                    }
                } catch (e) {}
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files: filesList }));
            return;
        }

        // API Endpoint: Get or Write active file content
        if (pathname === '/api/file') {
            const queryPath = parsedUrl.query.path;
            if (!queryPath) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing path parameter' }));
                return;
            }

            const targetFilePath = safePath(queryPath);

            if (method === 'GET') {
                if (fs.existsSync(targetFilePath)) {
                    const content = fs.readFileSync(targetFilePath, 'utf8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ content }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'File not found' }));
                }
                return;
            }

            if (method === 'POST') {
                const body = await getRequestBody(req);
                const content = body.content || '';
                fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
                fs.writeFileSync(targetFilePath, content, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: queryPath }));
                return;
            }

            if (method === 'DELETE') {
                if (fs.existsSync(targetFilePath)) {
                    fs.rmSync(targetFilePath, { recursive: true, force: true });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'File not found' }));
                }
                return;
            }
        }

        // API Endpoint: Execute terminal commands (matches terminal tool)
        if (pathname === '/api/execute' && method === 'POST') {
            const body = await getRequestBody(req);
            const command = body.command || '';
            
            if (!command.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Command cannot be empty' }));
                return;
            }

            // Simple command sanitization pattern mirroring TUI rules
            const dangerousPattern = /\b(rm|del|rd|erase|format|fdisk|shutdown|reboot)\b/i;
            if (dangerousPattern.test(command)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Access Denied: Command containing file deletion or system commands is restricted.' }));
                return;
            }

            exec(command, { cwd: WORKSPACE_DIR, timeout: 45000 }, (error, stdout, stderr) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error ? error.message : null
                }));
            });
            return;
        }

        // API Endpoint: Recursive search (Grep tool)
        if (pathname === '/api/search' && method === 'POST') {
            const body = await getRequestBody(req);
            const query = body.query || '';
            if (!query) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Query parameter is required' }));
                return;
            }

            const results = [];
            function searchDir(dir) {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (item.startsWith('.') || item === 'node_modules' || item === 'chrome_profile_copy') continue;
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        searchDir(fullPath);
                    } else if (stat.isFile()) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        if (content.toLowerCase().includes(query.toLowerCase())) {
                            const lines = content.split('\n');
                            lines.forEach((line, idx) => {
                                if (line.toLowerCase().includes(query.toLowerCase())) {
                                    results.push({
                                        filename: path.relative(WORKSPACE_DIR, fullPath),
                                        lineNum: idx + 1,
                                        content: line.trim()
                                    });
                                }
                            });
                        }
                    }
                }
            }

            searchDir(WORKSPACE_DIR);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ results }));
            return;
        }

        // Static File Server
        let filePath = path.join(WORKSPACE_DIR, pathname === '/' ? 'index.html' : pathname);
        filePath = path.resolve(filePath);

        if (filePath.startsWith(WORKSPACE_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
        }

    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, () => {
    console.log(`[CORE BRIDGE] Server actively listening at http://localhost:${PORT}`);
});