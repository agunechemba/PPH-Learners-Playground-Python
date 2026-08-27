(function() {
    'use strict';

    // ----- DOM refs -----
    const editor = document.getElementById('editor-python');
    const highlighting = document.getElementById('highlighting-python');
    const lineNumbers = document.getElementById('lineNumbers-python');
    const outputBox = document.getElementById('outputBox');
    const runBtn = document.getElementById('runBtn');
    const resetBtn = document.getElementById('resetBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const statusText = document.getElementById('statusText');

    // ----- Pyodide state -----
    let pyodide = null;
    let isRunning = false;

    // ----- DOWNLOAD FUNCTION -----
    function downloadCode() {
        const code = editor.value;
        if (!code.trim()) {
            appendOutput('⚠ No code to download!', 'dim');
            return;
        }

        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'python_script.py';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
        
        appendOutput('✓ Downloaded as python_script.py', 'success');
    }

    // ----- THEME SWITCHING - Device theme by default -----
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function getStoredTheme() {
        return localStorage.getItem('pph-theme') || null;
    }

    function setTheme(theme) {
        const root = document.documentElement;
        
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
            localStorage.setItem('pph-theme', 'dark');
            themeToggleBtn.textContent = '☀️';
        } else if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
            localStorage.setItem('pph-theme', 'light');
            themeToggleBtn.textContent = '🌙';
        } else {
            root.removeAttribute('data-theme');
            localStorage.removeItem('pph-theme');
            const systemTheme = getSystemTheme();
            themeToggleBtn.textContent = systemTheme === 'dark' ? '☀️' : '🌙';
        }
    }

    function toggleTheme() {
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme');
        
        if (currentTheme === 'dark') {
            setTheme('light');
        } else if (currentTheme === 'light') {
            setTheme('auto');
        } else {
            setTheme('dark');
        }
    }

    function initializeTheme() {
        const stored = getStoredTheme();
        if (stored === 'dark' || stored === 'light') {
            setTheme(stored);
        } else {
            setTheme('auto');
        }
    }

    initializeTheme();

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', (e) => {
        const root = document.documentElement;
        if (!root.hasAttribute('data-theme')) {
            themeToggleBtn.textContent = e.matches ? '☀️' : '🌙';
        }
    });

    themeToggleBtn.addEventListener('click', toggleTheme);

    // ----- Line numbers -----
    function updateLineNumbers() {
        const lines = editor.value.split('\n').length;
        let nums = '';
        for (let i = 1; i <= lines; i++) {
            nums += i + '\n';
        }
        lineNumbers.textContent = nums;
    }

    // ----- Syntax highlighting -----
    function updateHighlighting() {
        const code = editor.value;
        
        let escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        let result = '';
        let i = 0;
        const len = escaped.length;
        
        while (i < len) {
            if (escaped[i] === '#') {
                let start = i;
                while (i < len && escaped[i] !== '\n') {
                    i++;
                }
                result += '<span class="token comment">' + escaped.substring(start, i) + '</span>';
                continue;
            }
            
            if (escaped[i] === '"' || escaped[i] === "'") {
                let start = i;
                let quote = escaped[i];
                i++;
                while (i < len && escaped[i] !== quote) {
                    if (escaped[i] === '\\' && i + 1 < len) {
                        i += 2;
                    } else {
                        i++;
                    }
                }
                if (i < len && escaped[i] === quote) {
                    i++;
                }
                result += '<span class="token string">' + escaped.substring(start, i) + '</span>';
                continue;
            }
            
            if (escaped[i] === 'f' && i + 1 < len && (escaped[i+1] === '"' || escaped[i+1] === "'")) {
                let start = i;
                i++;
                let quote = escaped[i];
                i++;
                while (i < len && escaped[i] !== quote) {
                    if (escaped[i] === '\\' && i + 1 < len) {
                        i += 2;
                    } else {
                        i++;
                    }
                }
                if (i < len && escaped[i] === quote) {
                    i++;
                }
                result += '<span class="token string">' + escaped.substring(start, i) + '</span>';
                continue;
            }
            
            if (/[0-9]/.test(escaped[i])) {
                let start = i;
                while (i < len && /[0-9.]/.test(escaped[i])) {
                    i++;
                }
                result += '<span class="token number">' + escaped.substring(start, i) + '</span>';
                continue;
            }
            
            if (/[a-zA-Z_]/.test(escaped[i])) {
                let start = i;
                while (i < len && /[a-zA-Z0-9_]/.test(escaped[i])) {
                    i++;
                }
                let word = escaped.substring(start, i);
                
                const keywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 
                    'with', 'try', 'except', 'finally', 'return', 'yield', 'break', 'continue', 'pass', 
                    'True', 'False', 'None', 'and', 'or', 'not', 'is', 'in', 'lambda', 'global', 'nonlocal', 
                    'assert', 'del', 'raise'];
                
                const builtins = ['print', 'input', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 
                    'set', 'tuple', 'open', 'sum', 'max', 'min', 'abs', 'sorted', 'reversed', 'enumerate', 
                    'zip', 'map', 'filter', 'type', 'isinstance', 'issubclass', 'super', 'property', 
                    'staticmethod', 'classmethod', 'all', 'any', 'dir', 'help', 'vars', 'id', 'eval', 'exec', 
                    'compile', 'repr', 'chr', 'ord', 'bin', 'hex', 'oct', 'format', 'round', 'pow', 'divmod', 
                    'hash', 'memoryview', 'object', 'slice', 'bytes', 'bytearray', 'complex', 'bool'];
                
                if (keywords.includes(word)) {
                    result += '<span class="token keyword">' + word + '</span>';
                } else if (builtins.includes(word)) {
                    result += '<span class="token function">' + word + '</span>';
                } else {
                    result += word;
                }
                continue;
            }
            
            if (/[+\-*/%=<>!&|^~]/.test(escaped[i])) {
                let start = i;
                while (i < len && /[+\-*/%=<>!&|^~]/.test(escaped[i])) {
                    i++;
                }
                result += '<span class="token operator">' + escaped.substring(start, i) + '</span>';
                continue;
            }
            
            if (/[(),.[\]{}:;]/.test(escaped[i])) {
                result += '<span class="token punctuation">' + escaped[i] + '</span>';
                i++;
                continue;
            }
            
            result += escaped[i];
            i++;
        }
        
        highlighting.innerHTML = result;
    }

    function syncEditor() {
        updateLineNumbers();
        updateHighlighting();
    }

    editor.addEventListener('input', syncEditor);
    editor.addEventListener('scroll', () => {
        highlighting.scrollTop = editor.scrollTop;
        highlighting.scrollLeft = editor.scrollLeft;
        lineNumbers.scrollTop = editor.scrollTop;
    });

    // ----- Output helpers -----
    function clearOutput() {
        outputBox.innerHTML = '';
    }
    function appendOutput(text, className = '') {
        const div = document.createElement('div');
        div.textContent = text;
        if (className) div.className = className;
        outputBox.appendChild(div);
        outputBox.scrollTop = outputBox.scrollHeight;
    }
    function setOutputError(message) {
        clearOutput();
        const div = document.createElement('div');
        div.className = 'error';
        div.textContent = '⚠ ' + message;
        outputBox.appendChild(div);
    }
    function setStatus(text) {
        statusText.textContent = text;
    }

    // ----- Run Python code -----
    async function runPython(code) {
        if (isRunning) return;
        if (!code.trim()) {
            clearOutput();
            appendOutput('⏎ (empty code)', 'dim');
            return;
        }

        if (!pyodide) {
            setStatus('loading…');
            clearOutput();
            appendOutput('⏳ Loading Python runtime …', 'dim');
            try {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
                document.head.appendChild(script);
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                });
                pyodide = await globalThis.loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
                });
                setStatus('ready');
                clearOutput();
                appendOutput('✓ Python ready', 'success');
            } catch (err) {
                setStatus('error');
                setOutputError(`Failed to load Python: ${err.message || err}`);
                return;
            }
        }

        isRunning = true;
        setStatus('running…');
        clearOutput();

        pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
        `);

        let output = '';
        let error = null;
        try {
            await pyodide.runPythonAsync(code);
        } catch (e) {
            error = e;
        }

        const stdout = pyodide.runPython('sys.stdout.getvalue()');
        const stderr = pyodide.runPython('sys.stderr.getvalue()');
        if (stdout) output += stdout;
        if (stderr) output += stderr;

        pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
        `);

        if (error) {
            const errMsg = error.message || String(error);
            if (output.trim()) appendOutput(output);
            setOutputError(`Python error: ${errMsg}`);
            setStatus('error');
        } else {
            if (output.trim()) {
                const lines = output.split('\n');
                for (let line of lines) {
                    appendOutput(line);
                }
            } else {
                appendOutput('(no output)', 'dim');
            }
            setStatus('ready');
        }
        isRunning = false;
    }

    function handleRun() {
        const code = editor.value;
        runPython(code);
    }

    function resetExample() {
        const example = `print("👋 Welcome to PPH Learners Playground!")
name = "Pythonista"
print(f"Hello, {name}!")
for i in range(3):
    print(f"  count {i}")
print("✨ Ready to code!")`;
        editor.value = example;
        syncEditor();
        clearOutput();
        appendOutput('› example loaded · press Run', 'dim');
        setStatus('idle');
    }

    // ----- Keyboard shortcut -----
    editor.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleRun();
        }
    });

    // ----- Event listeners -----
    runBtn.addEventListener('click', handleRun);
    resetBtn.addEventListener('click', resetExample);
    downloadBtn.addEventListener('click', downloadCode);

    // ----- Init -----
    syncEditor();
    clearOutput();
    appendOutput('› ready · press Run or Ctrl+Enter', 'dim');
    setStatus('idle');

    // ----- Preload pyodide -----
    setTimeout(() => {
        if (!pyodide) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
            script.onload = async () => {
                try {
                    pyodide = await globalThis.loadPyodide({
                        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
                    });
                    setStatus('ready');
                    clearOutput();
                    appendOutput('✓ Python interpreter loaded', 'success');
                } catch (_) { /* ignore */ }
            };
            document.head.appendChild(script);
        }
    }, 400);
})();