const http = require('http');

console.log('Sending request to 127.0.0.1:3000/api/test-save...');

http.get('http://127.0.0.1:3000/api/test-save', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\n--- Verification Result ---');
      console.log(`Success: ${json.success}`);
      console.log('Logs:');
      json.logs.forEach((log) => console.log(`  - ${log}`));
      if (json.error) {
        console.error(`Error details: ${json.error}`);
      }
      console.log('---------------------------\n');
    } catch (e) {
      console.error('Failed to parse JSON response:', e.message);
      console.log('Raw output:', data);
    }
  });
}).on('error', (err) => {
  console.error('Request failed with error:', err);
});
