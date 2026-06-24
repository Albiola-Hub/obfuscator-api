const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const session = require('express-session');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

app.use(session({
    secret: 'supersecretkey123',
    resave: false,
    saveUninitialized: true
}));

const PASSWORD = "sttaralbiola";

// ================== SUPABASE SETUP (HARDCODED) ==================
const supabaseUrl = "https://vwtzbbxzcokqiggkmowc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3dHpiYnh6Y29rcWlnZ2ttb3djIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzMDQ0MiwiZXhwIjoyMDk3ODA2NDQyfQ.vtZ9uXyLXLnwCxglqnHvIqqM8oxuWOYt4Qi-ludGmGo";
const bucketName = "obfuscated";

const supabase = createClient(supabaseUrl, supabaseKey);

// ================== PATH TO PROMETHEUS CLI ==================
// __dirname-based so it resolves correctly no matter what the process's
// working directory is on Render.
const PROMETHEUS_CLI = path.join(__dirname, 'Prometheus', 'cli.lua');
const TEMP_DIR = os.tmpdir();

// ================== OBFS API (LOADER SCRIPT) ==================
app.post('/api/obfuscate', (req, res) => {
    const rawCode = req.body.code;

    if (!rawCode) {
        return res.status(400).json({ error: 'Walang code na nilagay!' });
    }

    const id = randomUUID();
    const inputFile = path.join(TEMP_DIR, `temp_in_${id}.lua`);
    const outputFile = path.join(TEMP_DIR, `temp_out_${id}.lua`);

    const cleanup = () => {
        try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (e) {
            console.error("Cleanup error:", e.message);
        }
    };

    try {
        fs.writeFileSync(inputFile, rawCode);

        // NOTE: Prometheus' cli.lua takes the input file as a plain
        // positional argument — there is no --file flag. Passing --file
        // was the bug causing every request to fail with "Obfuscation failed."
        execFile(
            'luajit',
            [
                PROMETHEUS_CLI,
                '--preset', 'Medium',
                inputFile,
                '--out', outputFile
            ],
            async (error, stdout, stderr) => {
                if (error) {
                    console.error("Engine error:", stderr || error.message);
                    cleanup();
                    return res.status(500).json({ error: 'Obfuscation failed.' });
                }

                try {
                    if (!fs.existsSync(outputFile)) {
                        cleanup();
                        return res.status(500).json({ error: 'No output generated.' });
                    }

                    const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');

                    // Upload sa Supabase bucket
                    const fileName = `${id}.lua`;
                    const { error: uploadError } = await supabase
                        .storage
                        .from(bucketName)
                        .upload(fileName, Buffer.from(obfuscatedCode, 'utf8'), {
                            contentType: 'text/plain',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error("Upload error:", uploadError.message);
                        cleanup();
                        return res.status(500).json({ error: 'Failed to upload.' });
                    }

                    // Kunin public URL
                    const { data: urlData } = supabase
                        .storage
                        .from(bucketName)
                        .getPublicUrl(fileName);

                    const publicUrl = urlData.publicUrl;

                    // Bumuo ng loader script
                    const loader = `loadstring(game:HttpGet("${publicUrl}"))()`;

                    cleanup();
                    return res.json({ result: loader });

                } catch (err) {
                    console.error("Error:", err.message);
                    cleanup();
                    return res.status(500).json({ error: 'Failed to process.' });
                }
            }
        );

    } catch (err) {
        console.error(err.message);
        cleanup();
        return res.status(500).json({ error: 'Server error.' });
    }
});

// ================== DOCS PAGE ==================
app.get('/docs', (req, res) => {
    if (!req.session.authenticated) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Obfuscator API – Login</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .card {
                        background: rgba(255,255,255,0.1);
                        backdrop-filter: blur(15px);
                        border-radius: 20px;
                        padding: 40px;
                        width: 100%;
                        max-width: 380px;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                        border: 1px solid rgba(255,255,255,0.15);
                        text-align: center;
                    }
                    .card h2 {
                        color: #fff;
                        margin-bottom: 20px;
                        font-weight: 600;
                        font-size: 1.8em;
                    }
                    .card input[type="password"] {
                        width: 100%;
                        padding: 14px 18px;
                        border: none;
                        border-radius: 12px;
                        background: rgba(255,255,255,0.08);
                        color: #fff;
                        font-size: 16px;
                        margin-bottom: 20px;
                        outline: none;
                        transition: 0.3s;
                        border: 1px solid rgba(255,255,255,0.2);
                    }
                    .card input[type="password"]:focus {
                        border-color: #a18cd1;
                        background: rgba(255,255,255,0.15);
                    }
                    .card button {
                        background: linear-gradient(135deg, #a18cd1, #fbc2eb);
                        border: none;
                        color: #1e1e2f;
                        font-weight: bold;
                        padding: 14px 30px;
                        border-radius: 12px;
                        font-size: 16px;
                        cursor: pointer;
                        width: 100%;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .card button:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 20px rgba(161,140,209,0.4);
                    }
                    .card p {
                        color: rgba(255,255,255,0.5);
                        margin-top: 15px;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🔐 Obfuscator API</h2>
                    <p style="color: rgba(255,255,255,0.7); margin-bottom: 20px;">Enter password to view docs</p>
                    <form method="POST" action="/docs">
                        <input type="password" name="password" placeholder="Password" required>
                        <button type="submit">Enter</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Obfuscator API – Documentation</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                    background: #0f172a;
                    color: #e2e8f0;
                    line-height: 1.6;
                    padding: 20px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 20px;
                    margin-bottom: 40px;
                    border-bottom: 1px solid #334155;
                    padding-bottom: 20px;
                }
                .header h1 {
                    font-size: 2.2em;
                    font-weight: 700;
                    background: linear-gradient(135deg, #a78bfa, #f472b6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .logout-btn {
                    background: #334155;
                    color: #cbd5e1;
                    padding: 8px 18px;
                    border-radius: 30px;
                    text-decoration: none;
                    font-size: 14px;
                    transition: 0.3s;
                }
                .logout-btn:hover {
                    background: #475569;
                    color: white;
                }
                .card {
                    background: #1e293b;
                    border-radius: 16px;
                    padding: 30px;
                    margin-bottom: 30px;
                    border: 1px solid #334155;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
                }
                .card h2 {
                    font-size: 1.5em;
                    margin-bottom: 15px;
                    color: #a78bfa;
                }
                .code-block {
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 20px;
                    font-family: 'Fira Code', monospace;
                    font-size: 15px;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    word-break: break-word;
                    margin: 15px 0;
                    color: #e2e8f0;
                }
                .method {
                    display: inline-block;
                    background: #a78bfa;
                    color: #0f172a;
                    padding: 2px 10px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 13px;
                    margin-right: 10px;
                }
                .endpoint {
                    font-size: 1.1em;
                    font-weight: 600;
                    color: #f8fafc;
                }
                .note {
                    background: #2d3748;
                    border-left: 4px solid #f472b6;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 25px;
                    color: #e2e8f0;
                    font-size: 14px;
                }
                @media (max-width: 600px) {
                    .container { padding: 20px 10px; }
                    .header h1 { font-size: 1.6em; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📚 Obfuscator API</h1>
                    <a href="/logout" class="logout-btn">Logout</a>
                </div>

                <div class="card">
                    <h2>🔹 Endpoint</h2>
                    <p><span class="method">POST</span><span class="endpoint">/api/obfuscate</span></p>
                    <p style="margin-top: 15px; color: #94a3b8;">Send Lua code, get a <strong>loader script</strong> with obfuscated code stored on Supabase.</p>
                </div>

                <div class="card">
                    <h2>📥 Request Body</h2>
                    <div class="code-block">
{ "code": "print('Hello world')" }
                    </div>
                </div>

                <div class="card">
                    <h2>📤 Response (Loader)</h2>
                    <div class="code-block">
loadstring(game:HttpGet("https://...supabase.../obfuscated/..."))()
                    </div>
                </div>

                <div class="note">
                    ⚡ <strong>Note:</strong> Obfuscated code is stored securely in Supabase. Medium preset.
                </div>
            </div>
        </body>
        </html>
    `);
});

// ================== LOGIN CHECK ==================
app.post('/docs', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        req.session.authenticated = true;
        return res.redirect('/docs');
    }
    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Wrong Password</title>
            <style>
                body {
                    background: #0f172a;
                    color: #f1f5f9;
                    font-family: 'Segoe UI', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                h2 { color: #f87171; }
                a { color: #a78bfa; text-decoration: none; margin-top: 20px; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h2>❌ Wrong password</h2>
            <p>Please try again.</p>
            <a href="/docs">← Back to Login</a>
        </body>
        </html>
    `);
});

// ================== LOGOUT ==================
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/docs');
    });
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
                                
