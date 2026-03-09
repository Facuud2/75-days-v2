const axios = require('axios');
axios.get('http://backend-core:3001/api/quests/available')
  .then(res => console.log('DATA:', res.data))
  .catch(err => console.error('ERR:', err.response ? err.response.status : err.message));
