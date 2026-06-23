const express = require('express');
const cors = require('cors');
const fs = require('fs');
const session = require('express-session');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');

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

// ================== CONFIG ==================
const PASSWORD = "sttaralbiola";
const ALLOWED_PRESETS = ['Low', 'Medium', 'High'];

// ================== OBFS API ==================
app.post('/api/obfuscate', (req, res) => {
    const rawCode = req.body.code;

    // NEW: customizable strength
    let preset = req.body.strength || 'Medium';

    if (!ALLOWED_PRESETS.includes(preset)) {
        preset = 'Medium';
    }

    if (!rawCode) {
        return res.status(400).json({ error: 'Walang code na nilagay!' });
    }

    const id = randomUUID();
    const inputFile = `temp_in_${id}.lua`;
    const outputFile = `temp_out_${id}.lua`;

    const cleanup = () => {
        try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (e) {
            console.error("Cleanup error:", e.message);
        }
    };

    try {
        // save input
        fs.writeFileSync(inputFile, rawCode);

        // run Prometheus safely
        execFile(
            'luajit',
            [
                'Prometheus/cli.lua',
                '--preset',
                preset,
                '--file',
                inputFile,
                '--out',
                outputFile
            ],
            (error, stdout, stderr) => {
                if (error) {
                    console.error("Engine error:", stderr || error.message);
                    cleanup();
                    return res.status(500).json({
                        error: 'Obfuscation failed.'
                    });
                }

                try {
                    if (!fs.existsSync(outputFile)) {
                        cleanup();
                        return res.status(500).json({
                            error: 'No output generated.'
                        });
                    }

                    const result = fs.readFileSync(outputFile, 'utf8');

                    cleanup();

                    return res.json({
                        preset,
                        result
                    });

                } catch (err) {
                    console.error("Read error:", err.message);
                    cleanup();
                    return res.status(500).json({
                        error: 'Failed to read output.'
                    });
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
            <html>
            <body style="font-family:Arial;text-align:center;margin-top:100px;">
                <h2>🔐 Enter Password</h2>
                <form method="POST" action="/docs">
                    <input type="password" name="password" placeholder="Password"
                        style="padding:10px;width:200px;" />
                    <br><br>
                    <button style="padding:10px 20px;">Enter</button>
                </form>
            </body>
            </html>
        `);
    }

    res.send(`
        <html>
        <body style="font-family:Arial;margin:40px;">
            <h1>📚 Obfuscator API Docs</h1>

            <h3>POST /api/obfuscate</h3>

            <pre>
Body:
{
  "code": "your lua code",
  "strength": "Low | Medium | High"
}
            </pre>

            <h3>Response:</h3>
            <pre>
{
  "preset": "High",
  "result": "obfuscated code"
}
            </pre>

            <br><br>
            <a href="/logout">Logout</a>
        </body>
        </html>
    `);
});

// ================== LOGIN ==================
app.post('/docs', (req, res) => {
    const { password } = req.body;

    if (password === PASSWORD) {
        req.session.authenticated = true;
        return res.redirect('/docs');
    }

    return res.send(`
        <h2>❌ Wrong password</h2>
        <a href="/docs">Try again</a>
    `);
});

// ================== LOGOUT ==================
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/docs');
    });
});

// ================== START ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
