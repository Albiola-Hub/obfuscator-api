const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(cors()); 
app.use(express.json()); 

app.post('/api/obfuscate', (req, res) => {
    const rawCode = req.body.code;
    if (!rawCode) return res.status(400).json({ error: 'Walang code na nilagay!' });

    const id = Date.now();
    const inputFile = `temp_in_${id}.lua`;
    const outputFile = `temp_out_${id}.lua`;

    fs.writeFileSync(inputFile, rawCode);

    // Dahil sa bagong Dockerfile natin, andito na yung Prometheus folder
    const cmd = `lua Prometheus/cli.lua --preset Medium --file ${inputFile} --out ${outputFile}`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            return res.status(500).json({ error: 'Nag-fail ang obfuscation.' });
        }

        if (fs.existsSync(outputFile)) {
            const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');
            res.json({ result: obfuscatedCode });
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);
        } else {
            res.status(500).json({ error: 'Walang lumabas na output.' });
        }
    });
});

app.listen(process.env.PORT || 3000, () => console.log('Server running!'));
      
