const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');

const app = express();

// Security / limits
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');

app.post('/api/obfuscate', (req, res) => {
    const rawCode = req.body.code;

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
            console.error('Cleanup error:', e.message);
        }
    };

    try {
        // 1. Save input
        fs.writeFileSync(inputFile, rawCode);

        // 2. Run Prometheus safely (NO shell injection risk)
        execFile(
            'luajit',
            [
                'Prometheus/cli.lua',
                '--preset',
                'Medium',
                '--file',
                inputFile,
                '--out',
                outputFile
            ],
            (error, stdout, stderr) => {
                if (error) {
                    console.error('Engine Error:', stderr || error.message);
                    cleanup();
                    return res.status(500).json({
                        error: 'Nag-fail ang obfuscation engine.'
                    });
                }

                try {
                    if (!fs.existsSync(outputFile)) {
                        cleanup();
                        return res.status(500).json({
                            error: 'Walang output na nabuong file.'
                        });
                    }

                    const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');

                    cleanup();

                    return res.json({
                        result: obfuscatedCode
                    });

                } catch (readErr) {
                    console.error('Read Error:', readErr.message);
                    cleanup();
                    return res.status(500).json({
                        error: 'Error sa pagbabasa ng output.'
                    });
                }
            }
        );

    } catch (err) {
        console.error('Server Error:', err.message);
        cleanup();
        return res.status(500).json({
            error: 'Internal server error.'
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
