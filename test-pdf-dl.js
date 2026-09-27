const mongoose = require('mongoose');
const User = require('./models/User');
const pdfParse = require('pdf-parse');
const https = require('https');
require('dotenv').config();

mongoose.connect(process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/internpilot').then(async () => {
    const user = await User.findOne({'resumeVersions.0': {$exists: true}});
    if (user && user.resumeVersions) {
        const latest = user.resumeVersions[user.resumeVersions.length - 1];
        console.log('URL:', latest.fileUrl);
        
        https.get(latest.fileUrl, (res) => {
            const chunks = [];
            res.on('data', (d) => chunks.push(d));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                console.log('Buffer downloaded. Size:', buffer.length);
                try {
                    const result = await pdfParse(buffer);
                    console.log('PDF Parse length:', result.text ? result.text.length : 0);
                    console.log('Text:', result.text.substring(0, 100));
                } catch(e) {
                    console.log('PDF Parse Error:', e.message);
                }
                process.exit(0);
            });
        });
    } else {
        process.exit(0);
    }
});
