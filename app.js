// Global variables
let editors = {};
let currentTab = 'html';
let isResizing = false;
let autoSaveInterval;
let updateTimeout;

// Default code from the application data
const defaultCode = {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Code</title>
</head>
<body>
    <div class="container">
        <h1 id="title">Hello, World!</h1>
        <p>Welcome to your Online Code Editor!</p>
        <button onclick="changeColor()">Change Color</button>
    </div>
</body>
</html>`,
    css: `body {
    font-family: 'Arial', sans-serif;
    margin: 0;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    text-align: center;
    max-width: 500px;
}

#title {
    color: #333;
    margin-bottom: 1rem;
    transition: color 0.3s ease;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s ease;
}

button:hover {
    background: #764ba2;
}`,
    javascript: `let colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
let currentIndex = 0;

function changeColor() {
    const title = document.getElementById('title');
    title.style.color = colors[currentIndex];
    currentIndex = (currentIndex + 1) % colors.length;
}

// Add some interactivity
document.addEventListener('DOMContentLoaded', function() {
    console.log('Online Code Editor loaded successfully!');
    
    // Add click animation to the container
    const container = document.querySelector('.container');
    container.addEventListener('click', function(e) {
        if (e.target.tagName !== 'BUTTON') {
            this.style.transform = 'scale(1.05)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 200);
        }
    });
});`
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMonacoEditor();
    setupEventListeners();
    loadSavedSnippets();
    setupAutoSave();
    setupKeyboardShortcuts();
});

// Initialize Monaco Editor
function initializeMonacoEditor() {
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
    
    require(['vs/editor/editor.main'], function () {
        // Create HTML editor
        editors.html = monaco.editor.create(document.getElementById('htmlEditor'), {
            value: defaultCode.html,
            language: 'html',
            theme: 'vs-dark',
            fontSize: 14,
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
            }
        });

        // Create CSS editor
        editors.css = monaco.editor.create(document.getElementById('cssEditor'), {
            value: defaultCode.css,
            language: 'css',
            theme: 'vs-dark',
            fontSize: 14,
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
            }
        });

        // Create JavaScript editor
        editors.javascript = monaco.editor.create(document.getElementById('jsEditor'), {
            value: defaultCode.javascript,
            language: 'javascript',
            theme: 'vs-dark',
            fontSize: 14,
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
            }
        });

        // Setup editor change listeners
        Object.keys(editors).forEach(key => {
            editors[key].onDidChangeModelContent(() => {
                debounceUpdate();
            });
        });

        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';
        
        // Initial preview update
        updatePreview();
        
        // Load auto-saved content after editors are initialized
        setTimeout(loadAutoSave, 100);
        
        // Ensure all editors are properly sized
        setTimeout(() => {
            Object.keys(editors).forEach(key => {
                editors[key].layout();
            });
        }, 500);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', showSaveModal);
    
    // Load button (snippet selector)
    document.getElementById('snippetSelector').addEventListener('change', loadSnippet);
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportCode);
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', updatePreview);
    
    // Fullscreen button
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
    
    // Clear console button
    document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);

    // Modal controls
    document.getElementById('closeModal').addEventListener('click', hideSaveModal);
    document.getElementById('cancelSave').addEventListener('click', hideSaveModal);
    document.getElementById('confirmSave').addEventListener('click', saveSnippet);
    
    // Enter key in save modal
    document.getElementById('snippetName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveSnippet();
        }
    });
    
    // Close modal on backdrop click
    document.getElementById('saveModal').addEventListener('click', (e) => {
        if (e.target.id === 'saveModal') hideSaveModal();
    });

    // Notification close
    document.getElementById('closeNotification').addEventListener('click', hideNotification);

    // Resize functionality
    setupResizeHandle();
}

// Tab switching with proper editor layout
function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update active editor panel
    document.querySelectorAll('.editor-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${tabName}Editor`).classList.add('active');

    currentTab = tabName;
    
    // Focus the active editor and ensure proper layout
    if (editors[tabName]) {
        setTimeout(() => {
            editors[tabName].layout();
            editors[tabName].focus();
        }, 50);
    }
}

// Debounced preview update
function debounceUpdate() {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(updatePreview, 500);
}

// Update preview
function updatePreview() {
    const html = editors.html?.getValue() || '';
    const css = editors.css?.getValue() || '';
    const js = editors.javascript?.getValue() || '';

    const previewContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>
                // Override console methods to capture output
                (function() {
                    const originalLog = console.log;
                    const originalError = console.error;
                    const originalWarn = console.warn;
                    
                    console.log = function(...args) {
                        originalLog.apply(console, args);
                        parent.postMessage({
                            type: 'console',
                            method: 'log',
                            args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                        }, '*');
                    };
                    
                    console.error = function(...args) {
                        originalError.apply(console, args);
                        parent.postMessage({
                            type: 'console',
                            method: 'error',
                            args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                        }, '*');
                    };
                    
                    console.warn = function(...args) {
                        originalWarn.apply(console, args);
                        parent.postMessage({
                            type: 'console',
                            method: 'warn',
                            args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                        }, '*');
                    };
                    
                    // Capture runtime errors
                    window.onerror = function(message, source, lineno, colno, error) {
                        parent.postMessage({
                            type: 'console',
                            method: 'error',
                            args: [\`Error: \${message} (line \${lineno})\`]
                        }, '*');
                        return false;
                    };
                })();
                
                try {
                    ${js}
                } catch (error) {
                    console.error('JavaScript Error:', error.message);
                }
            </script>
        </body>
        </html>
    `;

    const iframe = document.getElementById('previewFrame');
    const blob = new Blob([previewContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    
    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Listen for console messages from iframe
window.addEventListener('message', function(event) {
    if (event.data.type === 'console') {
        addConsoleMessage(event.data.method, event.data.args.join(' '));
    }
});

// Add console message
function addConsoleMessage(method, message) {
    const consoleOutput = document.getElementById('consoleOutput');
    const messageEl = document.createElement('div');
    messageEl.className = `console-log console-${method}`;
    messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleOutput.appendChild(messageEl);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Clear console
function clearConsole() {
    document.getElementById('consoleOutput').innerHTML = '';
}

// Show save modal
function showSaveModal() {
    document.getElementById('saveModal').classList.remove('hidden');
    document.getElementById('snippetName').focus();
}

// Hide save modal
function hideSaveModal() {
    document.getElementById('saveModal').classList.add('hidden');
    document.getElementById('snippetName').value = '';
}

// Save snippet
function saveSnippet() {
    const name = document.getElementById('snippetName').value.trim();
    
    if (!name) {
        showNotification('Please enter a snippet name.', 'error');
        return;
    }

    const snippet = {
        name: name,
        html: editors.html?.getValue() || '',
        css: editors.css?.getValue() || '',
        javascript: editors.javascript?.getValue() || '',
        timestamp: new Date().toISOString()
    };

    // Get existing snippets
    const snippets = JSON.parse(localStorage.getItem('codeSnippets') || '{}');
    snippets[name] = snippet;
    
    // Save to localStorage
    try {
        localStorage.setItem('codeSnippets', JSON.stringify(snippets));
        showNotification(`Snippet "${name}" saved successfully!`, 'success');
        hideSaveModal();
        loadSavedSnippets();
    } catch (error) {
        showNotification('Error saving snippet. Storage might be full.', 'error');
    }
}

// Load saved snippets into dropdown - Fixed implementation
function loadSavedSnippets() {
    const selector = document.getElementById('snippetSelector');
    const snippets = JSON.parse(localStorage.getItem('codeSnippets') || '{}');
    
    // Clear existing options except the first one
    selector.innerHTML = '<option value="">Select Snippet...</option>';
    
    // Add snippets to dropdown
    Object.keys(snippets).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selector.appendChild(option);
    });
    
    // If there are no saved snippets, show a helpful message
    if (Object.keys(snippets).length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No saved snippets';
        option.disabled = true;
        selector.appendChild(option);
    }
}

// Load snippet - Enhanced with better error handling
function loadSnippet() {
    const selector = document.getElementById('snippetSelector');
    const snippetName = selector.value;
    
    if (!snippetName) return;
    
    const snippets = JSON.parse(localStorage.getItem('codeSnippets') || '{}');
    const snippet = snippets[snippetName];
    
    if (snippet && editors.html) {
        try {
            editors.html.setValue(snippet.html || '');
            editors.css.setValue(snippet.css || '');
            editors.javascript.setValue(snippet.javascript || '');
            
            // Update preview after a short delay to ensure editors are updated
            setTimeout(updatePreview, 100);
            showNotification(`Snippet "${snippetName}" loaded successfully!`, 'success');
        } catch (error) {
            showNotification(`Error loading snippet "${snippetName}".`, 'error');
            console.error('Load snippet error:', error);
        }
    } else {
        showNotification('Snippet not found or editors not ready.', 'error');
    }
}

// Export code
function exportCode() {
    const html = editors.html?.getValue() || '';
    const css = editors.css?.getValue() || '';
    const js = editors.javascript?.getValue() || '';

    const fullCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Code</title>
    <style>
${css}
    </style>
</head>
<body>
${html}
    <script>
${js}
    </script>
</body>
</html>`;

    const blob = new Blob([fullCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported-code.html';
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Code exported successfully!', 'success');
}

// Toggle fullscreen
function toggleFullscreen() {
    const previewSection = document.getElementById('previewSection');
    previewSection.classList.toggle('fullscreen');
    
    const button = document.getElementById('fullscreenBtn');
    if (previewSection.classList.contains('fullscreen')) {
        button.textContent = 'Exit Fullscreen';
    } else {
        button.textContent = 'Fullscreen';
    }
}

// Setup resize handle
function setupResizeHandle() {
    const resizeHandle = document.getElementById('resizeHandle');
    const editorSection = document.getElementById('editorSection');
    const previewSection = document.getElementById('previewSection');
    const container = document.querySelector('.editor-main');

    resizeHandle.addEventListener('mousedown', startResize);

    function startResize(e) {
        isResizing = true;
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    }

    function resize(e) {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const containerWidth = containerRect.width;
        
        const percentage = (mouseX / containerWidth) * 100;
        const clampedPercentage = Math.min(Math.max(percentage, 20), 80);
        
        editorSection.style.flex = `0 0 ${clampedPercentage}%`;
        
        // Resize editors after layout change
        setTimeout(() => {
            Object.keys(editors).forEach(key => {
                if (editors[key]) {
                    editors[key].layout();
                }
            });
        }, 10);
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
}

// Auto-save functionality
function setupAutoSave() {
    autoSaveInterval = setInterval(() => {
        if (editors.html) {
            const autoSave = {
                html: editors.html.getValue(),
                css: editors.css.getValue(),
                javascript: editors.javascript.getValue(),
                timestamp: new Date().toISOString()
            };
            
            try {
                localStorage.setItem('autoSave', JSON.stringify(autoSave));
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }
        }
    }, 30000); // Auto-save every 30 seconds
}

// Load auto-saved content on startup
function loadAutoSave() {
    const autoSave = localStorage.getItem('autoSave');
    if (autoSave && editors.html) {
        try {
            const data = JSON.parse(autoSave);
            const lastSave = new Date(data.timestamp);
            const now = new Date();
            const diffMinutes = (now - lastSave) / (1000 * 60);
            
            // Only load if auto-save is less than 1 hour old and editors have default content
            if (diffMinutes < 60) {
                const hasDefaultContent = 
                    editors.html.getValue() === defaultCode.html &&
                    editors.css.getValue() === defaultCode.css &&
                    editors.javascript.getValue() === defaultCode.javascript;
                
                if (hasDefaultContent && (data.html !== defaultCode.html || data.css !== defaultCode.css || data.javascript !== defaultCode.javascript)) {
                    editors.html.setValue(data.html || '');
                    editors.css.setValue(data.css || '');
                    editors.javascript.setValue(data.javascript || '');
                    updatePreview();
                    showNotification('Auto-saved content restored.', 'info');
                }
            }
        } catch (error) {
            console.warn('Failed to load auto-save:', error);
        }
    }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            showSaveModal();
        }
        
        // Ctrl+Enter to refresh preview
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            updatePreview();
        }
        
        // Escape to close modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('saveModal');
            if (!modal.classList.contains('hidden')) {
                hideSaveModal();
            }
        }
        
        // Tab switching with Ctrl+1,2,3
        if (e.ctrlKey && ['1', '2', '3'].includes(e.key)) {
            e.preventDefault();
            const tabs = ['html', 'css', 'javascript'];
            const tabIndex = parseInt(e.key) - 1;
            if (tabs[tabIndex]) {
                switchTab(tabs[tabIndex]);
            }
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notificationMessage');
    
    notification.className = `notification ${type}`;
    messageEl.textContent = message;
    notification.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        hideNotification();
    }, 3000);
}

// Hide notification
function hideNotification() {
    document.getElementById('notification').classList.add('hidden');
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
});

// Handle window resize to update editor layouts
window.addEventListener('resize', function() {
    setTimeout(() => {
        Object.keys(editors).forEach(key => {
            if (editors[key]) {
                editors[key].layout();
            }
        });
    }, 100);
});