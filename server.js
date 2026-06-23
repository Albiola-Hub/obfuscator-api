const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();

// Pinapayagan nito ang LuaShield (Lovable AI) na makakonekta sa server mo
app.use(cors()); 
app.use(express.json()); 

app.post('/api/obfuscate', (req, res) => {
    const rawCode = req.body.code;
    if (!rawCode) return res.status(400).json({ error: 'Walang code na nilagay!' });

    const id = Date.now();
    const inputFile = `temp_in_${id}.lua`;
    const outputFile = `temp_out_${id}.lua`;

    // 1. I-save muna ang pinadalang code ng user
    fs.writeFileSync(inputFile, rawCode);

    // 2. Patakbuhin ang Prometheus gamit ang luajit (Mas stable sa Alpine Linux ng Render)
    const cmd = `luajit Prometheus/cli.lua --preset Medium --file ${inputFile} --out ${outputFile}`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error('Engine Error:', stderr);
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            return res.status(500).json({ error: 'Nag-fail ang obfuscation engine.' });
        }

        // 3. Basahin ang resulta at ibalik sa LuaShield
        if (fs.existsSync(outputFile)) {
            const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');
            
            res.json({ result: obfuscatedCode });

            // 4. Burahin ang mga temporary files para malinis ang server
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);
        } else {
            res.status(500).json({ error: 'Walang lumabas na output file mula sa engine.' });
        }
    });
});

// Siguraduhing naka-set sa port ng Render o sa port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
        
