const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();
mongoose.connect(process.env.ATLASDB_URL).then(async () => {
    const user = await User.findOne({'resumeVersions.0': {$exists: true}});
    if (user && user.resumeVersions) {
        const latest = user.resumeVersions[user.resumeVersions.length - 1];
        console.log('LATEST RESUME:', latest.fileName);
        console.log('Text Length:', latest.text ? latest.text.length : 0);
        console.log('Text snippet:', latest.text ? latest.text.substring(0, 100) : 'EMPTY');
    }
    process.exit(0);
});
