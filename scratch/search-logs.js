const fs = require('fs');
const file = '/Users/sachinsrivastava/.gemini/antigravity-ide/brain/ab641f65-e607-4080-b08a-a4d02dc9637d/.system_generated/logs/transcript.jsonl';
try {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('.env')) {
      console.log(`Line ${index + 1}: ${line.substring(0, 300)}`);
    }
  });
} catch (e) {
  console.error(e);
}
