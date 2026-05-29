const { chromium } = require('playwright');
const { exec } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

// Helper to save Windows Clipboard Image to file (runs PowerShell script)
function getClipboardImage(targetPath) {
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms, System.Drawing;
        $img = Get-Clipboard -Format Image;
        if ($img) {
            $img.Save('${targetPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png);
            Write-Output "SUCCESS";
            Exit;
        }
        $files = Get-Clipboard -Format File;
        if ($files) {
            $file = $files[0];
            $ext = [System.IO.Path]::GetExtension($file).ToLower();
            if ($ext -eq '.png' -or $ext -eq '.jpg' -or $ext -eq '.jpeg' -or $ext -eq '.webp' -or $ext -eq '.gif') {
                Copy-Item $file -Destination '${targetPath.replace(/\\/g, '\\\\')}' -Force;
                Write-Output "SUCCESS";
                Exit;
            }
        }
        Write-Output "NO_IMAGE";
    `;
    
    try {
        const { spawnSync } = require('child_process');
        const result = spawnSync('powershell', ['-NoProfile', '-Command', psScript], { encoding: 'utf8' });
        return result.stdout.trim() === 'SUCCESS';
    } catch (e) {
        return false;
    }
}

// Helper to check if text input is a valid image file path
function isImagePath(text) {
    const cleanText = text.replace(/['"]/g, '').trim();
    if (fs.existsSync(cleanText)) {
        const ext = path.extname(cleanText).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext);
    }
    return false;
}

// Helper to format response in an OpenCode / Open Interpreter TUI style
function formatText(text) {
    const lines = text.split('\n');
    let formatted = '';
    let inCode = false;
    
    const cols = Math.max(40, (process.stdout.columns || 80) - 4);
    
    for (let line of lines) {
        if (line.trim().startsWith('```')) {
            inCode = !inCode;
            if (inCode) {
                const lang = line.trim().substring(3).toUpperCase() || 'CODE';
                const headerPrefix = `┌── ${lang} `;
                const remainingDashes = Math.max(5, cols - headerPrefix.length - 2);
                formatted += `${C.dim}┌── ${C.bold}${C.cyan}${lang}${C.dim} ${'─'.repeat(remainingDashes)}┐${C.reset}\n`;
            } else {
                formatted += `${C.dim}└${'─'.repeat(cols - 1)}┘${C.reset}\n`;
            }
        } else {
            if (inCode) {
                formatted += `${C.dim}│${C.reset}  ${C.white}${line}${C.reset}\n`;
            } else {
                let styled = line.replace(/\*\*(.*?)\*\*/g, `${C.bold}$1${C.reset}`);
                if (styled.trim().startsWith('* ') || styled.trim().startsWith('- ')) {
                    styled = styled.replace(/^\s*[\*\-]\s+/, `  ${C.cyan}•${C.reset} `);
                }
                formatted += `${styled}\n`;
            }
        }
    }
    return formatted.trimEnd();
}

// Custom interactive file picker and text input loop using raw stdout cursor manipulation
function getPromptInput(C, banner, attachedFiles = [], pendingUpload = null) {
    return new Promise((resolve) => {
        const allFiles = fs.readdirSync(process.cwd()).filter(file => {
            try {
                return fs.statSync(file).isFile() && file !== 'clipboard_temp.png' && !file.startsWith('.');
            } catch (e) {
                return false;
            }
        });
        
        let inputString = '';
        let cursorIndex = 0;
        let mode = 'normal'; // 'normal' or 'file_select'
        let searchQuery = '';
        let selectedIndex = 0;
        let viewportStart = 0;
        
        let lastTargetLine = 0;

        // Long-poll the web server for prompts sent via Aether UI
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:3000/api/chat-poll');
                const data = await res.json();
                if (data.prompt) {
                    clearInterval(pollInterval);
                    cleanup();
                    if (lastTargetLine > 0) {
                        process.stdout.write(`\x1B[${lastTargetLine}A\r\x1B[J`);
                    } else {
                        process.stdout.write('\r\x1B[J');
                    }
                    resolve({ type: 'web', content: data.prompt });
                }
            } catch (e) {
                // Bridge server not online yet or error
            }
        }, 1000);
        
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        
        const render = () => {
            const cols = process.stdout.columns || 80;
            
            if (lastTargetLine > 0) {
                process.stdout.write(`\x1B[${lastTargetLine}A\r\x1B[J`);
            } else {
                process.stdout.write('\r\x1B[J');
            }
            
            let attachedLabel = '';
            if (attachedFiles.length > 0) {
                attachedLabel = `${C.yellow}${C.bold}[Files Attached: ${attachedFiles.join(', ')}]${C.reset} `;
            }
            
            let imageLabel = '';
            if (pendingUpload) {
                imageLabel = `${C.magenta}${C.bold}[Image Loaded]${C.reset} `;
            }
            
            const labelPrefix = `${attachedLabel}${imageLabel}${C.green}${C.bold}You > ${C.reset}`;
            const labelPrefixLen = getVisibleLength(labelPrefix);
            
            let promptText = '';
            let cursorOffset = 0;
            
            if (mode === 'normal') {
                promptText = labelPrefix + inputString;
                cursorOffset = labelPrefixLen + getVisibleLength(inputString.slice(0, cursorIndex));
            } else {
                promptText = labelPrefix + `#${C.cyan}${C.bold}${searchQuery}${C.reset}`;
                cursorOffset = labelPrefixLen + 1 + getVisibleLength(searchQuery);
            }
            
            process.stdout.write(promptText);
            
            const promptLen = getVisibleLength(promptText);
            const promptHeight = Math.max(1, Math.ceil(promptLen / cols));
            
            let menuLines = [];
            
            if (mode === 'file_select') {
                const boxWidth = Math.min(76, cols - 4);
                const filtered = allFiles.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
                if (selectedIndex >= filtered.length) {
                    selectedIndex = Math.max(0, filtered.length - 1);
                }
                
                const displayCount = 5;
                if (selectedIndex < viewportStart) {
                    viewportStart = selectedIndex;
                } else if (selectedIndex >= viewportStart + displayCount) {
                    viewportStart = selectedIndex - displayCount + 1;
                }
                if (viewportStart > Math.max(0, filtered.length - displayCount)) {
                    viewportStart = Math.max(0, filtered.length - displayCount);
                }
                
                const start = viewportStart;
                const end = Math.min(filtered.length, start + displayCount);
                
                const titleText = ` Select File to Attach (Arrow Keys + Enter) `;
                const dashesTotal = boxWidth - 4 - titleText.length;
                const dashesLeft = Math.floor(dashesTotal / 2);
                const dashesRight = dashesTotal - dashesLeft;
                menuLines.push(`\n${C.dim}┌${'─'.repeat(Math.max(1, dashesLeft))} ${C.reset}${titleText}${C.dim}${'─'.repeat(Math.max(1, dashesRight))}┐${C.reset}`);
                
                if (filtered.length === 0) {
                    const noFilesMsg = `No files found matching "${searchQuery}"`;
                    const padding = Math.max(0, boxWidth - 2 - getVisibleLength(noFilesMsg));
                    menuLines.push(`${C.dim}│${C.reset}  ${C.magenta}${noFilesMsg}${C.reset}${' '.repeat(padding)}${C.dim}│${C.reset}`);
                } else {
                    for (let i = start; i < end; i++) {
                        const file = filtered[i];
                        const isSelected = i === selectedIndex;
                        const pointer = isSelected ? `${C.cyan}▸${C.reset}` : ' ';
                        const style = isSelected ? `${C.cyan}${C.bold}` : '';
                        
                        let displayName = file;
                        if (displayName.length > boxWidth - 6) {
                            displayName = displayName.substring(0, boxWidth - 9) + '...';
                        }
                        
                        const leftPaddingLen = 4;
                        const contentLen = getVisibleLength(displayName);
                        const rightPadding = Math.max(0, boxWidth - leftPaddingLen - contentLen);
                        
                        menuLines.push(`${C.dim}│${C.reset} ${pointer} ${style}${displayName}${C.reset}${' '.repeat(rightPadding)}${C.dim}│${C.reset}`);
                    }
                }
                menuLines.push(`${C.dim}└${'─'.repeat(boxWidth)}┘${C.reset}`);
                
                process.stdout.write(menuLines.join('\n'));
            }
            
            const menuHeight = menuLines.length;
            const currentHeight = promptHeight + menuHeight;
            
            const targetLine = Math.floor(cursorOffset / cols);
            const targetCol = cursorOffset % cols;
            const linesToGoUp = (currentHeight - 1) - targetLine;
            
            if (linesToGoUp > 0) {
                process.stdout.write(`\x1B[${linesToGoUp}A`);
            }
            process.stdout.write('\r');
            if (targetCol > 0) {
                process.stdout.write(`\x1B[${targetCol}C`);
            }
            
            lastTargetLine = targetLine;
        };
        
        const onKeypress = (str, key) => {
            if (key.ctrl && key.name === 'c') {
                cleanup();
                console.log(`\n${C.yellow}Goodbye! Closing automation session.${C.reset}`);
                process.exit(0);
            }
            
            if (mode === 'normal') {
                if (key.name === 'return' || key.name === 'enter') {
                    cleanup();
                    console.log();
                    resolve(inputString);
                } else if (key.name === 'backspace') {
                    if (cursorIndex > 0) {
                        inputString = inputString.slice(0, cursorIndex - 1) + inputString.slice(cursorIndex);
                        cursorIndex--;
                        render();
                    }
                } else if (key.name === 'left') {
                    if (cursorIndex > 0) {
                        cursorIndex--;
                        render();
                    }
                } else if (key.name === 'right') {
                    if (cursorIndex < inputString.length) {
                        cursorIndex++;
                        render();
                    }
                } else if (key.name === 'home') {
                    cursorIndex = 0;
                    render();
                } else if (key.name === 'end') {
                    cursorIndex = inputString.length;
                    render();
                } else if (str === '#') {
                    mode = 'file_select';
                    searchQuery = '';
                    selectedIndex = 0;
                    viewportStart = 0;
                    render();
                } else if (str && str.length === 1) {
                    inputString = inputString.slice(0, cursorIndex) + str + inputString.slice(cursorIndex);
                    cursorIndex += str.length;
                    render();
                }
            } else {
                const filtered = allFiles.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
                
                if (key.name === 'up') {
                    if (filtered.length > 0) {
                        selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
                    }
                    render();
                } else if (key.name === 'down') {
                    if (filtered.length > 0) {
                        selectedIndex = (selectedIndex + 1) % filtered.length;
                    }
                    render();
                } else if (key.name === 'return' || key.name === 'enter') {
                    if (filtered.length > 0 && selectedIndex < filtered.length) {
                        const file = filtered[selectedIndex];
                        if (!attachedFiles.includes(file)) {
                            attachedFiles.push(file);
                        }
                    }
                    mode = 'normal';
                    render();
                } else if (key.name === 'escape') {
                    mode = 'normal';
                    render();
                } else if (key.name === 'backspace') {
                    if (searchQuery.length > 0) {
                        searchQuery = searchQuery.slice(0, -1);
                    } else {
                        mode = 'normal';
                    }
                    render();
                } else if (str && str.length === 1 && str !== '#') {
                    searchQuery += str;
                    render();
                }
            }
        };
        
        function cleanup() {
            clearInterval(pollInterval);
            process.stdin.removeListener('keypress', onKeypress);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
        }
        
        process.stdin.on('keypress', onKeypress);
        render();
    });
}

// Rich ANSI Terminal Styling Codes
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    cyanBg: "\x1b[46m",
    blackFg: "\x1b[30m"
};

// Helper to get visible length of styled strings by stripping ANSI codes and counting CJK/emojis as 2 cells
function getVisibleLength(str) {
    const clean = str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    let len = 0;
    for (let i = 0; i < clean.length; i++) {
        const code = clean.charCodeAt(i);
        if (code >= 0xD800 && code <= 0xDBFF) {
            len += 2;
            i++;
        } else if (code > 0xFF) {
            len += 2;
        } else {
            len += 1;
        }
    }
    return len;
}

// Beautiful ASCII Art Banner for Google AI Studio
const banner = `
${C.cyan}${C.bold} ██████╗  ██████╗  ██████╗  ██████╗ ██╗     ███████╗
██╔════╝ ██╔═══██╗██╔═══██╗██╔════╝ ██║     ██╔════╝
██║  ███╗██║   ██║██║   ██║██║  ███╗██║     █████╗  
██║   ██║██║   ██║██║   ██║██║   ██║██║     ██╔══╝  
╚██████╔╝╚██████╔╝╚██████╔╝╚██████╔╝███████╗███████╗
 ╚═════╝  ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚══════╝
 ██████╗  ████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
██╔══██╗ ╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
███████║    ██║   ██║   ██║██║  ██║██║██║   ██║
██╔══██║    ██║   ██║   ██║██║  ██║██║██║   ██║
██║  ██║    ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
╚═╝  ╚═╝    ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ ${C.reset}
     ${C.yellow}${C.bold}--- Premium CDP Google AI Studio Terminal ---${C.reset}
`;

function clearConsole() {
    process.stdout.write('\x1Bc');
}

// Helper to check for blocked dangerous commands and file deletion operations via shell
function isDangerousCommand(cmd) {
    const dangerousPatterns = [
        /\brm\b/i,                     // Block rm commands (forces agent to use safe 'delete' tool)
        /\bdel\b/i,                    // Block del commands (forces agent to use safe 'delete' tool)
        /\brd\b/i,                     // Block rd commands (forces agent to use safe 'delete' tool)
        /\berase\b/i,                  // Block erase commands
        /\bformat\b/i,                 // Block disk format
        /\bfdisk\b/i,                  // Block disk partition
        /\bshutdown\b/i,               // Block system shutdown
        /\breboot\b/i,                 // Block system reboot
        /\bmkfs\b/i,                   // Block filesystem creation
        /\binit\s+[0-6]\b/i,           // Block runlevel change
        /\bcurl\b.*\|\s*(sh|bash|cmd|powershell|pwsh)/i, // Block pipe downloads
        /\bwget\b.*\|\s*(sh|bash|cmd|powershell|pwsh)/i, // Block pipe downloads
        /\bkill\b\s+-9\b/i,            // Block kill -9
        /\bkillall\b/i,                // Block killall
        /:.*{.*:.*|.*&.*}.*;.*/,      // Block fork bombs
    ];
    return dangerousPatterns.some(pattern => pattern.test(cmd));
}

// Interactive prompt helper to ask for permission
function askUserPermission(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
}

// Secure Local Tool Executor
async function executeLocalTool(toolName, args) {
    try {
        const normalWorkspace = path.resolve(process.cwd()).toLowerCase();
        
        let targetPath = '';
        if (args.path) {
            targetPath = path.resolve(process.cwd(), args.path);
            const normalTarget = targetPath.toLowerCase();
            
            // Safety guard: Boundary check (case-insensitive for Windows)
            if (!normalTarget.startsWith(normalWorkspace)) {
                return `[ERROR: Access Denied. Path lies outside the workspace directory.]`;
            }
        }
        
        if (toolName === 'write_file' || toolName === 'write') {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, args.content, 'utf8');
            return `[SUCCESS: File successfully written to ${args.path}]`;
        }
        
        if (toolName === 'read_file' || toolName === 'read') {
            if (!fs.existsSync(targetPath)) {
                return `[ERROR: File not found at path ${args.path}]`;
            }
            const content = fs.readFileSync(targetPath, 'utf8');
            return `[SUCCESS: Read File ${args.path} contents:\n${content}]`;
        }
        
        if (toolName === 'list_directory' || toolName === 'list') {
            if (!fs.existsSync(targetPath)) {
                return `[ERROR: Directory not found at path ${args.path}]`;
            }
            const stats = fs.statSync(targetPath);
            if (!stats.isDirectory()) {
                return `[ERROR: Path ${args.path} is a file, not a directory. Use read_file instead.]`;
            }
            const items = fs.readdirSync(targetPath);
            const itemDetails = items.map(item => {
                const itemPath = path.join(targetPath, item);
                try {
                    const itemStats = fs.statSync(itemPath);
                    const type = itemStats.isDirectory() ? '[DIR]' : '[FILE]';
                    const size = itemStats.isFile() ? ` (${itemStats.size} bytes)` : '';
                    return `${type} ${item}${size}`;
                } catch (e) {
                    return `[UNKNOWN] ${item}`;
                }
            });
            return `[SUCCESS: Contents of directory "${args.path}":\n${itemDetails.join('\n')}]`;
        }
        
        if (toolName === 'replace' || toolName === 'edit') {
            if (!fs.existsSync(targetPath)) {
                return `[ERROR: File not found at path ${args.path}]`;
            }
            let content = fs.readFileSync(targetPath, 'utf8');
            const chunks = args.chunks || [];
            
            if (chunks.length === 0) {
                const target = args.target;
                const replacement = args.replacement;
                if (!target) {
                    return `[ERROR: No target specified for replacement. Please wrap the exact block of text to change in <target>...</target> tags.]`;
                }
                if (!content.includes(target)) {
                    return `[ERROR: Target content not found in ${args.path}. Make sure the target text matches exactly, including spacing/newlines.]`;
                }
                const occurrences = content.split(target).length - 1;
                if (occurrences > 1) {
                    return `[ERROR: Target content is ambiguous; found ${occurrences} times in ${args.path}. Please provide a longer, unique block of text surrounding the line you want to replace.]`;
                }
                content = content.replace(target, replacement);
            } else {
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const target = chunk.target;
                    const replacement = chunk.replacement;
                    
                    if (!target) {
                        return `[ERROR in chunk ${i + 1}: No target specified.]`;
                    }
                    if (!content.includes(target)) {
                        return `[ERROR in chunk ${i + 1}: Target content not found in ${args.path}. Make sure the target text matches exactly, including spacing/newlines.]`;
                    }
                    const occurrences = content.split(target).length - 1;
                    if (occurrences > 1) {
                        return `[ERROR in chunk ${i + 1}: Target content is ambiguous; found ${occurrences} times in ${args.path}. Please provide a longer, unique block of text surrounding the line you want to replace.]`;
                    }
                    content = content.replace(target, replacement);
                }
            }
            
            fs.writeFileSync(targetPath, content, 'utf8');
            return `[SUCCESS: Successfully applied all replacement chunks in ${args.path}]`;
        }

        // TOOL 1: Terminal Shell Command Executor
        if (toolName === 'execute' || toolName === 'execute_command') {
            const cmd = args.content || args.command || '';
            if (!cmd.trim()) {
                return `[ERROR: Command content is empty]`;
            }
            
            if (isDangerousCommand(cmd)) {
                return `[ERROR: Access Denied. Command contains blocked dangerous patterns or file-deletion operations. Please use the specific "delete" tool to remove files/directories so that explicit safety permissions can be requested.]`;
            }
            
            console.log(`\n${C.yellow}⚙️  Command Execution: Running "${cmd}"...${C.reset}`);
            
            return new Promise((resolve) => {
                const { exec } = require('child_process');
                exec(cmd, { cwd: process.cwd(), timeout: 45000 }, (error, stdout, stderr) => {
                    let output = '';
                    if (stdout) output += `[STDOUT]\n${stdout}\n`;
                    if (stderr) output += `[STDERR]\n${stderr}\n`;
                    if (error) output += `[EXECUTION ERROR: ${error.message}]\n`;
                    
                    if (!output) output = '[SUCCESS: Command executed with no stdout/stderr output]';
                    resolve(output.substring(0, 10000)); // Cap output to 10k chars
                });
            });
        }

        // TOOL 2: Codebase Search / Grep
        if (toolName === 'search' || toolName === 'grep') {
            const query = args.query;
            if (!query) {
                return `[ERROR: No search query specified]`;
            }
            
            const searchDir = args.path ? path.resolve(process.cwd(), args.path) : process.cwd();
            if (!searchDir.toLowerCase().startsWith(normalWorkspace)) {
                return `[ERROR: Access Denied. Search path lies outside the workspace directory.]`;
            }
            
            const results = [];
            const maxMatches = 50;
            
            function recursiveSearch(dir) {
                if (results.length >= maxMatches) return;
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (item.startsWith('.') || item === 'node_modules' || item === 'chrome_profile_copy' || item === 'scratch') continue;
                    const fullPath = path.join(dir, item);
                    try {
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            recursiveSearch(fullPath);
                        } else if (stats.isFile()) {
                            const ext = path.extname(item).toLowerCase();
                            const isBinary = ['.png', '.jpg', '.jpeg', '.gif', '.zip', '.pdf', '.exe', '.dll', '.ico', '.mp3', '.mp4'].includes(ext);
                            if (isBinary) continue;
                            
                            const fileContent = fs.readFileSync(fullPath, 'utf8');
                            if (fileContent.toLowerCase().includes(query.toLowerCase())) {
                                const lines = fileContent.split('\n');
                                lines.forEach((line, idx) => {
                                    if (line.toLowerCase().includes(query.toLowerCase()) && results.length < maxMatches) {
                                        const relPath = path.relative(process.cwd(), fullPath);
                                        results.push(`${relPath}:${idx + 1}: ${line.trim()}`);
                                    }
                                });
                            }
                        }
                    } catch (e) {}
                }
            }
            
            recursiveSearch(searchDir);
            
            if (results.length === 0) {
                return `[SUCCESS: No matches found for query "${query}"]`;
            }
            return `[SUCCESS: Found ${results.length} matches for "${query}":\n${results.join('\n')}]`;
        }

        // TOOL 3: Filesystem Operations (move / copy / delete)
        if (toolName === 'move' || toolName === 'copy' || toolName === 'delete') {
            if (toolName === 'delete') {
                if (!fs.existsSync(targetPath)) {
                    return `[ERROR: File or folder not found at path ${args.path}]`;
                }
                
                // Intercept deletion and request developer's permission!
                console.log(`\n\x1b[43m\x1b[30m ⚠️  SECURITY INTERCEPT: DELETION REQUESTED ⚠️ \x1b[0m`);
                const relativePath = path.relative(process.cwd(), targetPath);
                
                const approved = await askUserPermission(
                    `${C.bold}The co-pilot wants to DELETE the file/folder: ${C.magenta}${relativePath}${C.reset}\n` +
                    `${C.bold}Allow this deletion? (y/N): ${C.reset}`
                );
                
                if (!approved) {
                    return `[ERROR: Access Denied. User explicitly rejected deletion of ${args.path}.]`;
                }
                
                fs.rmSync(targetPath, { recursive: true, force: true });
                return `[SUCCESS: Successfully deleted file/folder "${args.path}"]`;
            }
            
            if (toolName === 'move' || toolName === 'copy') {
                if (!args.from || !args.to) {
                    return `[ERROR: Missing "from" or "to" paths for ${toolName}]`;
                }
                
                const fromPath = path.resolve(process.cwd(), args.from);
                const toPath = path.resolve(process.cwd(), args.to);
                
                if (!fromPath.toLowerCase().startsWith(normalWorkspace) || !toPath.toLowerCase().startsWith(normalWorkspace)) {
                    return `[ERROR: Access Denied. Source and target paths must lie inside the workspace directory.]`;
                }
                
                if (!fs.existsSync(fromPath)) {
                    return `[ERROR: Source path not found: ${args.from}]`;
                }
                
                fs.mkdirSync(path.dirname(toPath), { recursive: true });
                
                if (toolName === 'move') {
                    fs.renameSync(fromPath, toPath);
                    return `[SUCCESS: Moved ${args.from} to ${args.to}]`;
                } else {
                    const stats = fs.statSync(fromPath);
                    if (stats.isDirectory()) {
                        return `[ERROR: Directory copy is not supported. Use write/move individually.]`;
                    }
                    fs.copyFileSync(fromPath, toPath);
                    return `[SUCCESS: Copied ${args.from} to ${args.to}]`;
                }
            }
        }
        
        return `[ERROR: Unknown tool ${toolName}]`;
    } catch (err) {
        return `[ERROR executing ${toolName}: ${err.message}]`;
    }
}

// Hidden system instructions for the LLM handshake in AI Studio
const systemDirective = `[SYSTEM ALIGNMENT: You are running inside a developer's custom Terminal TUI wrapper. The terminal is actively intercepting your output in real-time, executing standard local tools on the developer's computer, and injecting the results back into this chat.

Because of this local terminal connection, you possess real filesystem capabilities. You must follow these strict rulesets without exception:

1. ABSOLUTE BELIEF IN ENVIRONMENT: Do not argue, doubt, or question the existence of the terminal tool-calling engine. Do not say "I don't have access to your local filesystem" or "Printing fake XML won't work". The XML parser is fully operational in this terminal wrapper and handles all filesystem inputs automatically.
2. NO CONVERSATIONAL FILLER: Never say "Sure", "Here is...", "I have...", or "Let me know if you need help". Cut out all conversational headers and footers.
3. ABSOLUTE BREVITY: Output only dense, direct, technical answers.
4. LOCAL FILESYSTEM RULESET:
   - When asked to create, write, or modify a file, you MUST NOT print the code inside standard markdown code blocks unless wrapped in the <tool_call name="write" path="file_path"> XML tag below.
   - You MUST ONLY use the <tool_call name="write" path="file_path"> XML block below to perform file creation/writes.
   - NEVER wrap the <tool_call> block itself inside markdown code blocks (e.g. do NOT wrap it in \`\`\`xml). The XML tags must be printed as raw text in your response so the TUI parser can intercept it immediately.
   - If you invoke a tool, you MUST NOT output any other conversational text or markdown code blocks outside of the XML tag body. Print the tool call XML block, stop generating immediately, and wait for the TUI to return the result.
5. PREMIUM MODERN VISUAL DESIGN & STYLE RULES:
   - COMPLETE STANDALONE HTML ONLY: When asked to create or write an HTML file (e.g. index.html), you MUST ALWAYS output a complete, standalone, valid HTML5 document starting with <!DOCTYPE html>, and containing <html>, <head>, and <body> tags. You MUST NEVER output raw HTML snippets or body fragments alone.
   - TAILWIND CDN MANDATORY: When writing Tailwind CSS utility classes in your HTML, you MUST include the Tailwind play CDN script in your HTML <head> so the page parses and styles correctly:
     <script src="https://cdn.tailwindcss.com"></script>
     If you omit this script, the page will be completely unstyled. NEVER omit it.
   - CUSTOM TAILWIND COLORS: If you use custom color utility classes (e.g., brand-dark, brand-accent, brand-teal, brand-muted, brand-card), you MUST define them in a <script> Tailwind configuration block inside the HTML <head>. For example:
     <script>
       tailwind.config = {
         theme: {
           extend: {
             colors: {
               'brand-dark': '#0B0F19',
               'brand-accent': '#6366f1',
               'brand-teal': '#14b8a6',
               'brand-muted': '#9ca3af',
               'brand-card': '#111827'
             }
           }
         }
       }
     </script>
      If you use custom brand classes without defining them inside the Tailwind configuration script, they will not render and the page will be completely white/broken!
   - BASE BODY BACKGROUND & STYLING: Always set a base background color and text color class directly on your HTML <body> tag (such as class="bg-[#0B0F19] text-white min-h-screen font-sans") so the entire page renders with the correct background out-of-the-box.
   - STRICT SVG & ICON DIMENSIONS: Any inline SVGs or icons you write MUST have explicit width and height attributes (e.g. width="48" height="48" or class="w-12 h-12"). If you omit sizes, SVGs default to block level and expand to occupy the entire screen, breaking layout and visual flow.
   - MODERN AESTHETICS: Implement stunning visual aesthetics. Use sophisticated, high-fidelity color palettes (e.g. dark modes, vibrant gradients, premium brand colors) instead of plain generic colors. 
   - PREMIUM TYPOGRAPHY: Import modern Google Fonts (e.g., "Inter", "Outfit", "Plus Jakarta Sans") inside your HTML <head> to make text look premium and professional.
   - DYNAMIC INTERACTION: Add smooth transition animations (e.g., transition duration-300) and micro-interactions on hover/active states for buttons, links, and cards.

LOCAL TOOLS DEFINITION:
- To write or overwrite a file (MUST wrap standard markdown code block inside tool call):
<tool_call name="write" path="index.html">
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0B0F19] text-white font-sans min-h-screen">
  <!-- Complete layout goes here -->
</body>
</html>
\`\`\`
</tool_call>

- To make a targeted replacement/edit to specific sections of an existing file (highly preferred over overwriting the entire file):
For a single replacement:
<tool_call name="replace" path="relative/path/to/file.js">
<target>
// Old exact block of code to search for
</target>
<replacement>
// New block of code to replace it with
</replacement>
</tool_call>

For multiple replacements in a single turn:
<tool_call name="replace" path="relative/path/to/file.js">
<chunk>
<target>
// First old exact block
</target>
<replacement>
// First new block
</replacement>
</chunk>
<chunk>
<target>
// Second old exact block
</target>
<replacement>
// Second new block
</replacement>
</chunk>
</tool_call>

- To read a file:
<tool_call name="read" path="relative/path/to/file.json"></tool_call>

- To list the contents of a directory:
<tool_call name="list" path="relative/path/to/folder"></tool_call>

- To execute terminal shell commands safely (timeout 45s; all dangerous commands and file deletion flags are strictly restricted):
<tool_call name="execute">
npm run build
</tool_call>

- To search recursively for text matches in files across the codebase (Grep):
<tool_call name="search" query="functionName" path="optional/subdir"></tool_call>

- To move or copy files inside the workspace:
<tool_call name="move" from="source/path" to="destination/path"></tool_call>
<tool_call name="copy" from="source/path" to="destination/path"></tool_call>

- To delete files or directories (explicit interactive safety permissions will be requested from the user):
<tool_call name="delete" path="relative/path/to/file_or_dir"></tool_call>

If you invoke a tool, do NOT output any other conversational text. Print the tool block, stop generating, and wait for the system to return the execution result.]\n\n`;

// Google AI Studio System Instructions expander and filling helper
async function applySystemInstructions(page, C) {
    console.log(`${C.yellow}[LOG] Opening and configuring System instructions panel...${C.reset}`);
    try {
        const cardBtn = page.locator('button.system-instructions-card, [data-test-system-instructions-card]').first();
        await cardBtn.waitFor({ state: 'visible', timeout: 10000 });
        await cardBtn.click();
        await page.waitForTimeout(1000);
        
        const systemArea = page.locator('textarea[aria-label="System instructions"]').first();
        await systemArea.waitFor({ state: 'visible', timeout: 5000 });
        await systemArea.click();
        
        await systemArea.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, systemDirective);
        
        await page.waitForTimeout(500);
        
        const closeBtn = page.locator('button[data-test-close-button]').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
            console.log(`${C.green}[SUCCESS] System instructions configured successfully!${C.reset}`);
        }
    } catch (e) {
        console.error(`${C.magenta}[ERROR] Failed to set System instructions: ${e.message}${C.reset}`);
    }
}

(async () => {
    clearConsole();
    console.log(banner);
    console.log(`${C.dim}[LOG] Initializing secure browser process...${C.reset}`);

    const userDataDir = path.join(__dirname, 'chrome_profile_copy');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    
    // Start Chrome with active user profile and remote debugging enabled
    const command = `start "" "${chromePath}" --user-data-dir="${userDataDir}" --remote-debugging-port=9222`;
    exec(command);
    
    console.log(`${C.yellow}[LOG] Waiting for Chrome to launch...${C.reset}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`${C.cyan}[LOG] Attaching Playwright over Chrome Devtools Protocol...${C.reset}`);
    let browser, context, page;
    
    try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
        context = browser.contexts()[0];
        page = context.pages()[0] || await context.newPage();
    } catch (err) {
        console.error(`${C.magenta}[ERROR] Connection failed: ${err.message}${C.reset}`);
        console.error(`${C.yellow}Please ensure you signed in and that port 9222 is free.${C.reset}`);
        process.exit(1);
    }
    
    console.log(`${C.cyan}[LOG] Loading Google AI Studio Web Interface...${C.reset}`);
    await page.goto('https://aistudio.google.com/prompts/new_chat');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Apply system prompt on startup
    await applySystemInstructions(page, C);
    
    let pendingUpload = null;
    let attachedFiles = [];
    
    const askQuestion = async () => {
        const input = await getPromptInput(C, banner, attachedFiles, pendingUpload);
        const trimmedInput = input.trim();
        
        if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
            console.log(`\n${C.yellow}Goodbye! Closing automation session.${C.reset}`);
            await browser.close().catch(() => {});
            process.exit(0);
        }
        
        // 1. Handle Clipboard Image Paste Trigger (/paste or /clip)
        if (trimmedInput.toLowerCase() === '/paste' || trimmedInput.toLowerCase() === '/clip') {
            console.log(`${C.yellow}[INFO] Clipboard paste images is supported via file Drag and Drop in Google AI Studio.${C.reset}`);
            askQuestion();
            return;
        }
        
        // 2. Handle Start New Chat (/new or /reset)
        if (trimmedInput.toLowerCase() === '/new' || trimmedInput.toLowerCase() === '/reset') {
            console.log(`${C.yellow}[LOG] Triggering a new AI Studio chat session...${C.reset}`);
            try {
                const newChatLink = page.locator('a[href="/prompts/new_chat"]').first();
                await newChatLink.waitFor({ state: 'visible', timeout: 5000 });
                await newChatLink.click();
                await page.waitForTimeout(3000);
                attachedFiles = [];
                // Re-configure system instructions inside the new chat thread
                await applySystemInstructions(page, C);
                console.log(`${C.green}[SUCCESS] New chat playground started!${C.reset}`);
            } catch (err) {
                console.error(`${C.magenta}[ERROR] Failed to start new chat: ${err.message}${C.reset}`);
            }
            askQuestion();
            return;
        }
        
        // 3. Handle Unsupported Temporary Chats Trigger (/temp)
        if (trimmedInput.toLowerCase() === '/temp') {
            console.log(`${C.yellow}[LOG] Toggling Temporary Chat...${C.reset}`);
            try {
                const menuBtn = page.locator('button[aria-label="View more actions"]').first();
                await menuBtn.click();
                await page.waitForTimeout(500);
                
                const incognitoBtn = page.locator('button[data-test-incognito-toggle]').first();
                await incognitoBtn.waitFor({ state: 'visible', timeout: 5000 });
                await incognitoBtn.click();
                await page.waitForTimeout(2000);
                console.log(`${C.green}[SUCCESS] Temporary chat toggled successfully!${C.reset}`);
            } catch (err) {
                console.error(`${C.magenta}[ERROR] Failed to toggle temporary chat: ${err.message}${C.reset}`);
            }
            askQuestion();
            return;
        }
        
        if (trimmedInput === '' && attachedFiles.length === 0 && !pendingUpload) {
            askQuestion();
            return;
        }
        
        try {
            // Target Google AI Studio response chunks count
            const responseLocator = page.locator('.chat-turn-container.model .turn-content');
            const initialCount = await responseLocator.count();
            
            // Build prompt block
            let finalPrompt = trimmedInput;
            if (attachedFiles.length > 0) {
                if (finalPrompt.length > 0) {
                    finalPrompt += '\n\n';
                }
                for (let i = 0; i < attachedFiles.length; i++) {
                    const file = attachedFiles[i];
                    try {
                        const filePath = path.resolve(process.cwd(), file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        finalPrompt += `[${file}]:\n\`\`\`\n${content}\n\`\`\``;
                        if (i < attachedFiles.length - 1) {
                            finalPrompt += `\n-------\n`;
                        } else {
                            finalPrompt += `\n------`;
                        }
                    } catch (e) {
                        console.error(`\n${C.magenta}[ERROR] Could not read file "${file}": ${e.message}${C.reset}`);
                    }
                }
            }
            
            // Focus and fill prompt in Google AI Studio textarea
            const promptArea = page.locator('textarea[formcontrolname="promptText"]').first();
            await promptArea.waitFor({ state: 'visible', timeout: 10000 });
            await promptArea.click();
            
            await promptArea.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, finalPrompt);
            
            await page.waitForTimeout(500);
            
            // Trigger Submit action (Clicks with force:true to override notices, and uses keyboard enter)
            const runBtn = page.locator('button.ctrl-enter-submits').first();
            await runBtn.waitFor({ state: 'attached', timeout: 5000 });
            await runBtn.click({ force: true });
            
            const attachedList = [...attachedFiles];
            pendingUpload = null;
            attachedFiles = [];
            
            // Print user prompt
            console.log(`\n${C.bold}▌ User${C.reset}`);
            console.log(`${C.dim}────────────────────────────────────────────────────────────────────────────────${C.reset}`);
            let displayPrompt = trimmedInput;
            if (attachedList.length > 0) {
                const filesLabel = `${C.yellow}${C.bold}[Attached: ${attachedList.join(', ')}]${C.reset}`;
                displayPrompt = displayPrompt ? `${filesLabel} ${displayPrompt}` : filesLabel;
            }
            console.log(displayPrompt || '[Submitted]');
            
            // Stream response
            console.log(`\n${C.bold}▌ 🤖 Gemini (AI Studio)${C.reset}`);
            console.log(`${C.dim}────────────────────────────────────────────────────────────────────────────────${C.reset}`);
            
            const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let frameIndex = 0;
            
            // Monitor and Stream loopback
            const monitorResponse = async (initialResponseCount) => {
                let newCount = await responseLocator.count();
                const startTime = Date.now();
                
                const spinnerInterval = setInterval(() => {
                    process.stdout.write(`\r${C.cyan}${spinnerFrames[frameIndex]} Gemini is responding...${C.reset}`);
                    frameIndex = (frameIndex + 1) % spinnerFrames.length;
                }, 80);
                
                // Wait for Model response container to begin rendering (up to 1.5 minutes)
                while (newCount <= initialResponseCount && Date.now() - startTime < 90000) {
                    await page.waitForTimeout(100);
                    newCount = await responseLocator.count();
                }
                
                const newResponseLocator = responseLocator.last();
                await newResponseLocator.waitFor({ state: 'visible', timeout: 90000 });
                
                let lastText = '';
                let noChangeTicks = 0;
                const maxNoChangeTicks = 25;
                
                while (true) {
                    await page.waitForTimeout(200);
                    const currentText = await newResponseLocator.innerText();
                    
                    let isGenerating = false;
                    try {
                        const runBtn = page.locator('button.ctrl-enter-submits').first();
                        const btnText = await runBtn.innerText() || '';
                        isGenerating = btnText.toLowerCase().includes('stop');
                    } catch (e) {}
                    
                    if (currentText.length > lastText.length) {
                        lastText = currentText;
                        noChangeTicks = 0;
                    } else if (currentText.length > 0) {
                        noChangeTicks++;
                    }
                    
                    const trimmedText = currentText.trim();
                    if (isGenerating || trimmedText.toLowerCase().includes('thinking') || trimmedText.toLowerCase().includes('pondering')) {
                        noChangeTicks = 0;
                    }
                    
                    if (!isGenerating && noChangeTicks > 5) {
                        break;
                    }
                    
                    if (noChangeTicks >= maxNoChangeTicks) {
                        break;
                    }
                }
                
                clearInterval(spinnerInterval);
                process.stdout.write('\r\x1B[2K\r');
                
                // Intercept and parse XML tool call requests
                const toolStartMatch = lastText.match(/<tool_call name=["'](\w+)["'](?:\s*path=["'](.*?)["'])?\s*>/);
                
                if (toolStartMatch) {
                    const toolName = toolStartMatch[1];
                    const startIndex = toolStartMatch.index + toolStartMatch[0].length;
                    let body = lastText.substring(startIndex);
                    
                    const closingIndex = body.indexOf('</tool_call>');
                    if (closingIndex !== -1) {
                        body = body.substring(0, closingIndex);
                    }
                    
                    let pathVal = '';
                    if (toolStartMatch[2]) {
                        pathVal = toolStartMatch[2].trim();
                    } else {
                        const pathMatch = body.match(/<path>([\s\S]*?)<\/path>/);
                        if (pathMatch) {
                            pathVal = pathMatch[1].trim();
                        } else {
                            const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                            if (lines.length > 0) {
                                const firstLine = lines[0];
                                if (!firstLine.startsWith('<') && !firstLine.startsWith('`')) {
                                    pathVal = firstLine;
                                }
                            }
                        }
                    }
                    
                    let contentVal = '';
                    const contentMatch = body.match(/<content>([\s\S]*?)<\/content>/);
                    if (contentMatch) {
                        contentVal = contentMatch[1];
                    } else {
                        const codeBlockMatch = body.match(/```\w*\n([\s\S]*?)\n```/);
                        if (codeBlockMatch) {
                            contentVal = codeBlockMatch[1];
                        } else {
                            const lines = body.split('\n');
                            const firstNonEmptyIndex = lines.findIndex(l => l.trim().length > 0);
                            if (firstNonEmptyIndex !== -1) {
                                if (toolStartMatch[2] || toolName === 'execute' || toolName === 'execute_command') {
                                    contentVal = body.trim();
                                } else {
                                    contentVal = lines.slice(firstNonEmptyIndex + 1).join('\n').trim();
                                }
                            }
                        }
                    }
                    
                    contentVal = contentVal.replace(/^\s*<!\[CDATA\[/gi, '').replace(/\]\]>\s*$/gi, '').trim();

                    let targetVal = '';
                    const targetMatch = body.match(/<target>([\s\S]*?)<\/target>/);
                    if (targetMatch) {
                        targetVal = targetMatch[1];
                    }
                    
                    let replacementVal = '';
                    const replacementMatch = body.match(/<replacement>([\s\S]*?)<\/replacement>/);
                    if (replacementMatch) {
                        replacementVal = replacementMatch[1];
                    }
                    
                    const chunksList = [];
                    const chunkRegex = /<chunk>([\s\S]*?)<\/chunk>/g;
                    let cMatch;
                    while ((cMatch = chunkRegex.exec(body)) !== null) {
                        const chunkContent = cMatch[1];
                        const tMatch = chunkContent.match(/<target>([\s\S]*?)<\/target>/);
                        const rMatch = chunkContent.match(/<replacement>([\s\S]*?)<\/replacement>/);
                        if (tMatch && rMatch) {
                            chunksList.push({
                                target: tMatch[1],
                                replacement: rMatch[1]
                            });
                        }
                    }
                    
                    let queryVal = '';
                    const queryMatch = body.match(/<query>([\s\S]*?)<\/query>/);
                    if (queryMatch) {
                        queryVal = queryMatch[1].trim();
                    } else if (toolStartMatch[0].includes('query=')) {
                        const qMatch = toolStartMatch[0].match(/query=["'](.*?)["']/);
                        if (qMatch) queryVal = qMatch[1];
                    }
                    
                    let fromVal = '';
                    const fromMatch = body.match(/<from>([\s\S]*?)<\/from>/);
                    if (fromMatch) {
                        fromVal = fromMatch[1].trim();
                    } else if (toolStartMatch[0].includes('from=')) {
                        const fMatch = toolStartMatch[0].match(/from=["'](.*?)["']/);
                        if (fMatch) fromVal = fMatch[1];
                    }
                    
                    let toVal = '';
                    const toMatch = body.match(/<to>([\s\S]*?)<\/to>/);
                    if (toMatch) {
                        toVal = toMatch[1].trim();
                    } else if (toolStartMatch[0].includes('to=')) {
                        const tMatch = toolStartMatch[0].match(/to=["'](.*?)["']/);
                        if (tMatch) toVal = tMatch[1];
                    }
                    
                    const args = {
                        path: pathVal,
                        content: contentVal,
                        target: targetVal,
                        replacement: replacementVal,
                        chunks: chunksList,
                        query: queryVal,
                        from: fromVal,
                        to: toVal
                    };
                    
                    const targetDisplay = args.path ? ` on ${C.cyan}${args.path}${C.reset}` : '';
                    console.log(`\n${C.yellow}⚙️  Executing Local Tool: ${C.bold}${toolName}${C.reset}${targetDisplay}...`);
                    const executionResult = await executeLocalTool(toolName, args);
                    
                    const isSuccess = typeof executionResult === 'string' && executionResult.includes('SUCCESS');
                    const statusText = isSuccess 
                        ? `[SUCCESS: ${toolName} executed successfully]` 
                        : executionResult;
                    
                    console.log(`${isSuccess ? C.green : C.magenta}✓ ${statusText}${C.reset}`);
                    
                    const loopbackPayload = `[SYSTEM TOOL RESULT:\n${executionResult}\n\nReview this result and output your final answer or execute another tool if needed.]`;
                    
                    const editorArea = page.locator('textarea[formcontrolname="promptText"]').first();
                    await editorArea.waitFor({ state: 'visible', timeout: 10000 });
                    await editorArea.click();
                    
                    await editorArea.evaluate((el, val) => {
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, loopbackPayload);
                    
                    await page.waitForTimeout(500);
                    
                    const activeSendBtn = page.locator('button.ctrl-enter-submits').first();
                    await activeSendBtn.waitFor({ state: 'attached', timeout: 5000 });
                    await activeSendBtn.click({ force: true });
                    
                    await monitorResponse(newCount);
                    return;
                }
                
                const formatted = formatText(lastText);
                console.log(formatted + '\n');
            };
            
            await monitorResponse(initialCount);
            
        } catch (err) {
            console.error(`\n${C.magenta}[ERROR] Failed to communicate with Google AI Studio: ${err.message}${C.reset}`);
        }
        
        askQuestion();
    };
    
    askQuestion();
})();
